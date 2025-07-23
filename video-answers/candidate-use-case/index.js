const messages = require('./messages');

/** Escape quotes and backslashes for GraphQL string literals */
function esc(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Validate a name.
 * A name is considered valid when it:
 *   • is a non-empty string;
 *   • is not only underscores;
 *   • is not a placeholder such as "xxx", "XXX", "Xxxxx", etc.
 */
function isValidName(v) {
  if (typeof v !== 'string') return false;

  const name = v.trim();
  if (!name || /^_+$/.test(name)) return false;

  // Strip any non-letters to catch placeholders like "xxx/XXX"
  const lettersOnly = name
    .normalize('NFD')                // split accented letters
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z]/gi, '')          // keep ASCII letters only
    .toLowerCase();

  // Reject if the result is 3+ x's and nothing else (e.g. "xxx", "xxxxx")
  if (/^x{3,}$/.test(lettersOnly)) return false;

  return true;
}

exports.videoInterviewInvite = async (req, res) => {
  // Log incoming URL for debugging redirection issues
  try {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host  = req.headers['x-forwarded-host'] || req.headers.host || '';
    const path  = req.originalUrl || req.url || '';
    const fullUrl = host ? `${proto}://${host}${path}` : path;
    console.log('Request URL:', fullUrl);
  } catch (e) {
    // ignore logging errors
  }

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

  const email     = isValidEmail(rawEmail)     ? rawEmail.trim()
                 : isValidEmail(email_manual)  ? email_manual.trim()
                 : null;

  const firstName = isValidName(rawFirstName)      ? rawFirstName.trim()
                 : isValidName(first_name_manual) ? first_name_manual.trim()
                 : null;

  const redirectFormId = req.query.formId || 'cQjsMu76';
  const rawEmailValue = rawEmail || email_manual || '';
  const rawFirstValue = rawFirstName || first_name_manual || '';

  const needsRedirect =
    !email ||
    !firstName ||
    /%/.test(rawEmailValue) ||
    /%/.test(rawFirstValue);

  if (needsRedirect) {
    const url = `https://form.typeform.com/to/${redirectFormId}` +
      `#first_name=${encodeURIComponent(rawFirstValue)}` +
      `&email=${encodeURIComponent(rawEmailValue)}` +
      `&position_id=${encodeURIComponent(paramPositionId || '')}`;
    try {
      console.log('Redirecting to:', url);
    } catch (e) {
      // ignore logging errors
    }
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
  try {
    console.log('Interview URL:', publicUrl);
  } catch (e) {
    // ignore logging errors
  }

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
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Next steps</title></head>
<body>
  <h2>✅ Congrats ${firstName}, you passed the quiz.</h2>
  <p><strong>Next steps:</strong></p>
  <p><strong>1. Record 3 quick video answers.</strong> <a href="${publicUrl}">Click here to proceed</a></p>
  <p><strong>2. Interview with the hiring specialist.</strong> You'll get invitation after step one</p>
  <p>Looking forward to speaking with you,<br>
     Vladimir<br>
     <a href="https://www.linkedin.com/in/kobzevvvv/">LinkedIn</a>
  </p>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
};