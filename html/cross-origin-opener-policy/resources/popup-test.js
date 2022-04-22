// To use the functions below, be sure to include the following files in your
// test:
// - "/common/get-host-info.sub.js" to get the different origin values.
// - "common.js" to have the origins easily available.
// - "/common/dispatcher/dispatcher.js" for cross-origin messaging.
// - "/common/utils.js" for token().

function getExecutorPath(uuid, origin, coop) {
  const executor_path = '/common/dispatcher/executor.html?';
  const coop_header = `|header(Cross-Origin-Opener-Policy,${encodeURIComponent(coop)})`;
  return origin +
         executor_path +
         `uuid=${uuid}` +
         '&pipe=' + coop_header;
}

function getPopupHasOpener(popup_token) {
  const reply_token = token();
  send(popup_token, `send('${reply_token}', window.opener != null);`);
  return receive(reply_token);
}

// Return true if |object|.|property| can be called without throwing an error.
function canAccessProperty(object, property) {
  try {
    const unused = object[property];
    return true;
  } catch (errors) {
    return false;
  }
}

async function verifyPopupTestResults(origin, popup, popup_token, expected_opener_state) {
  const is_popup_closed = popup.closed;
  const popup_has_opener = await getPopupHasOpener(popup_token) === "true";
  const is_popup_same_origin = origin === SAME_ORIGIN;
  const has_dom_access = canAccessProperty(popup, "document");
  const has_cross_origin_access = canAccessProperty(popup, "frames");

  switch (expected_opener_state) {
    case 'preserved': {
      assert_false(is_popup_closed, 'Popup is closed from opener?');
      assert_true(popup_has_opener, 'Popup has nulled opener?');
      assert_equals(has_dom_access, is_popup_same_origin, 'Main page has dom access to the popup?');
      assert_true(has_cross_origin_access, 'Main page has cross origin access to the popup?');
      break;
    }
    case 'severed': {
      assert_true(is_popup_closed, 'Popup is closed from opener?');
      assert_false(popup_has_opener, 'Popup has nulled opener?');
      break;
    }
  }
}

/*
 * Verifies that a popup with origin `origin` and coop header `coop_header` has
 * the expected `opener_state` after being opened.
*/
async function popup_test(description, origin, coop_header, expected_opener_state) {
  promise_test(async t => {
    const popup_token = token();
    const reply_token = token();

    const popup_url = getExecutorPath(
      popup_token,
      origin.origin,
      coop_header);

    // We open popup and then ping it, it will respond after loading.
    const popup = window.open(popup_url);
    send(popup_token, `send('${reply_token}', 'Popup loaded');`);
    assert_equals(await receive(reply_token), 'Popup loaded');

    // Make sure the popup will be closed once the test has run, keeping a clean
    // state.
    t.add_cleanup(() => {
      send(popup_token, `close()`);
    });

    // Give some time for things to settle across processes etc. before
    // proceeding with verifications.
    await new Promise(resolve => { t.step_timeout(resolve, 500); });

    await verifyPopupTestResults(origin, popup, popup_token, expected_opener_state);
  }, description);
}

