const fetch = require('node-fetch');
const messages = require('./messages');

exports.interviewRedirect = async (req, res) => {
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
  const isNonEmpty   = (v) => typeof v === 'string' && v.trim() !== '';

  const email     = isValidEmail(rawEmail)     ? rawEmail.trim()
                 : isValidEmail(email_manual)  ? email_manual.trim()
                 : null;

  const firstName = isNonEmpty(rawFirstName)   ? rawFirstName.trim()
                 : isNonEmpty(first_name_manual) ? first_name_manual.trim()
                 : null;

  if (!email || !firstName) {
    res.status(400).send(t.missingInfo);
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
    `email: "${email}"`,
    `firstName: "${firstName}"`,
    isNonEmpty(lastName) ? `lastName: "${lastName.trim()}"` : null
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

  // --- Handle “already invited” gracefully --------------------------------------
  if (payload?.__typename === 'InterviewAlreadyExistsInPositionError') {
    res.status(200).send(`<h2>${t.inviteExists}</h2>`);
    return;
  }

  if (!publicUrl) {
    console.error('Unexpected Hireflix response', data);
    res.status(500).send(t.createFailed);
    return;
  }

  // --- Success: show auto-redirect page -----------------------------------------
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Hireflix</title></head>
<body>
  <h2 id="msg">${t.checkingProfile}</h2>
  <script>
    setTimeout(() => {
      document.getElementById('msg').innerText = "${t.redirectingSoon}";
      setTimeout(() => { window.location.href = '${publicUrl}'; }, 5000);
    }, 3000);
  </script>
</body></html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
};
