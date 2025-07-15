const messages = require('./messages');

/** Escape quotes and backslashes for GraphQL string literals */
function esc(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

exports.videoInterviewInvite = async (req, res) => {
  // --- Gather & validate inputs ------------------------------------------------
  const {
    email: rawEmail,
    email_manual,
    firstName: rawFirstName,
    first_name_manual,
    lastName,
    positionId: paramPositionId,
    language = 'english'          // english | russian | italian
  } = req.query;

  // Select language pack (default = English)
  const langKey = /^(russian|ru)$/i.test(language) ? 'ru'
               : /^(italian|it)$/i.test(language) ? 'it'
               : 'en';
  const t = messages[langKey];

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e?.trim());
  const isValidName  = (v) =>
    typeof v === 'string' &&
    v.trim() !== '' &&
    !/^_+$/.test(v.trim());

  const email     = isValidEmail(rawEmail)     ? rawEmail.trim()
                 : isValidEmail(email_manual)  ? email_manual.trim()
                 : null;

  const firstName = isValidName(rawFirstName)   ? rawFirstName.trim()
                 : isValidName(first_name_manual) ? first_name_manual.trim()
                 : null;

  const redirectFormId = req.query.formId || 'cQjsMu76';
  const rawEmailValue = rawEmail || email_manual || '';
  const rawFirstValue = rawFirstName || first_name_manual || '';

  const needsRedirect =
    !email ||
    !firstName ||
    /%|xxx/i.test(rawEmailValue) ||
    /%|xxx/i.test(rawFirstValue);

  if (needsRedirect) {
    const url = `https://form.typeform.com/to/${redirectFormId}` +
      `#first_name=${encodeURIComponent(rawFirstValue)}` +
      `&email=${encodeURIComponent(rawEmailValue)}` +
      `&position_id=${encodeURIComponent(paramPositionId || '')}`;
    res.redirect(302, url);
    return;
  }

  const apiKey     = process.env.HIREFLIX_API_KEY;
  if (!apiKey) {
    res.status(500).send(t.apiKeyMissing);
    return;
  }

  const positionId = paramPositionId || process.env.HIREFLIX_POSITION_ID;
  if (!positionId) {
    res.status(400).send('positionId param is required.');
    return;
  }

  // --- Build GraphQL mutation ---------------------------------------------------
  const candidateFields = [
    `email: "${esc(email)}"`,
    `firstName: "${esc(firstName)}"`,
    isValidName(lastName) ? `lastName: "${esc(lastName.trim())}"` : null
  ].filter(Boolean).join(', ');

  const query = `
    mutation InviteCandidateToInterview {
      inviteCandidateToInterview(
        input: {
          candidate: { ${candidateFields} },
          positionId: "${positionId}"
        }
      ) {
        __typename
        ... on InterviewType {
          url { public }
        }
        ... on InterviewAlreadyExistsInPositionError {
          message
        }
      }
    }
  `;

  // --- Call Hireflix ------------------------------------------------------------
  let data;
  try {
    const resp = await fetch('https://api.hireflix.com/me', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body:    JSON.stringify({ query })
    });
    data = await resp.json();
  } catch (err) {
    console.error('Hireflix request failed', err);
    res.status(500).send(t.hireflixContactError);
    return;
  }

  const payload = data?.data?.inviteCandidateToInterview;
  const publicUrl = payload?.url?.public;

  // --- Handle "already invited" gracefully --------------------------------------
  if (payload?.__typename === 'InterviewAlreadyExistsInPositionError') {
    res.status(200).send(`<h2>${t.inviteExists}</h2>`);
    return;
  }

  if (!publicUrl) {
    console.error('Unexpected Hireflix response', data);
    res.status(500).send(t.createFailed);
    return;
  }

  // --- Success: render status page ---------------------------------------------
  const tipsUrl = req.query.tipsDoc ||
    'https://docs.google.com/document/d/1dTFMB3X7OPbliV9V4a4XAqUjr2zkjm2-SMg_28E7Bd8/edit?tab=t.0#heading=h.9195iyi5xlof';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${t.statusPageTitle}</title></head>
<body>
  <h2>${t.statusPageTitle}</h2>
  <ul>
    <li><a href="${publicUrl}">${t.asyncInviteLink}</a></li>
    <li><a href="https://calendly.com/vladimir-hiretechfast/30min">${t.bookHumanLink}</a></li>
    <li><a href="${tipsUrl}">${t.interviewTips}</a></li>
  </ul>
</body></html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
};
