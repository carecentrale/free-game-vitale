// The sign-up form on /teachers.html (SPEC-032). Talks only to the site's own backend function teacher-interest
// (Supabase). Nothing is kept until the email is checked with the 6-digit code. No cookie, no storage, no tracking.
(function () {
  'use strict';
  var FN = 'https://rsrmuruskjtnxqmzvmnl.supabase.co/functions/v1/teacher-interest';
  var KEY = 'sb_publishable_htNBh34wAtN_LnqK3Nv6_A_OYT-v_MU';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('tForm'), codeForm = $('tCode'), done = $('tDone');
  var boxes = codeForm.querySelectorAll('.codebox input');
  var sent = null;   // the details of the request waiting for its code, in this page only

  var MESSAGES = {
    bad_code: 'That code is not right. Check the email and try again.',
    too_many_tries: 'Too many tries. Ask for a new code.',
    expired: 'That code has run out. Ask for a new code.',
    rate_limited: 'Please try again later.',
    invalid: 'Please check the form and try again.',
  };
  function say(el, text) { el.textContent = text || ''; el.hidden = !text; }
  function call(body) {
    return fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', apikey: KEY, authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.ok = r.ok && j.ok !== false; return j; }); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }
  // The checks the form needs before "Send me a code" does anything. Exposed for the tests.
  function check(v) {
    var missing = [];
    if (!v.name || v.name.length > 80) missing.push('tName');
    if (!v.school || v.school.length > 80) missing.push('tSchool');
    if (v.country !== 'CA' && v.country !== 'US') missing.push('tCountry');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) || v.email.length > 200) missing.push('tEmail');
    if (!v.adult) missing.push('tAdult');
    if (!v.consent) missing.push('tConsent');
    return missing;
  }
  window.teacherFormCheck = check;

  function values() {
    return { name: $('tName').value.trim(), school: $('tSchool').value.trim(), country: $('tCountry').value,
      email: $('tEmail').value.trim().toLowerCase(), adult: $('tAdult').checked, consent: $('tConsent').checked,
      consentText: $('tConsentText').textContent };
  }
  function askCode(v) {
    say($('tFormMsg'), ''); say($('tCodeMsg'), '');
    return call({ action: 'request', name: v.name, school: v.school, country: v.country, email: v.email, consent_text: v.consentText }).then(function (r) {
      if (!r.ok) { say(codeForm.hidden ? $('tFormMsg') : $('tCodeMsg'), MESSAGES[r.error] || 'Something went wrong. Please try again later.'); return; }
      sent = v;
      $('tSentTo').textContent = v.email;
      form.hidden = true; codeForm.hidden = false;
      boxes.forEach(function (b) { b.value = ''; });
      boxes[0].focus();
    });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = values(), missing = check(v);
    ['tName', 'tSchool', 'tCountry', 'tEmail', 'tAdult', 'tConsent'].forEach(function (id) { $(id + 'Err').hidden = missing.indexOf(id) < 0; });
    if (missing.length) { $(missing[0]).focus(); return; }
    askCode(v);
  });
  boxes.forEach(function (b, i) {
    b.addEventListener('input', function () {
      var d = b.value.replace(/\D/g, '');
      if (d.length > 1) { for (var k = 0; k < 6 && i + k < 6; k++) boxes[i + k].value = d[k] || ''; boxes[Math.min(5, i + d.length - 1)].focus(); return; }
      b.value = d; if (d && i < 5) boxes[i + 1].focus();
    });
    b.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus(); });
  });
  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = Array.prototype.map.call(boxes, function (b) { return b.value; }).join('');
    if (!/^\d{6}$/.test(code) || !sent) { say($('tCodeMsg'), MESSAGES.bad_code); return; }
    call({ action: 'confirm', email: sent.email, code: code }).then(function (r) {
      if (!r.ok) { say($('tCodeMsg'), MESSAGES[r.error] || MESSAGES.bad_code); return; }
      codeForm.hidden = true; done.hidden = false; sent = null;
    });
  });
  $('tResend').addEventListener('click', function () { if (sent) askCode(sent); });
  $('tChange').addEventListener('click', function () { codeForm.hidden = true; form.hidden = false; say($('tCodeMsg'), ''); $('tEmail').focus(); });
})();
