const fetch = require('node-fetch');

exports.interviewRedirect = async (req, res) => {
  const { email, firstName, lastName } = req.query;

  if (!email || !firstName || !lastName) {
    res.status(400).send('Missing candidate information.');
    return;
  }

  const apiKey = process.env.HIREFLIX_API_KEY;
  const positionId = '685416df1f7c312434d514b6';

  const query = `
    mutation InviteCandidateToInterview {
      inviteCandidateToInterview(
        input: {
          candidate: { email: "${email}", firstName: "${firstName}", lastName: "${lastName}" },
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

  let data;
  try {
    const resp = await fetch('https://api.hireflix.com/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ query }),
    });
    data = await resp.json();
  } catch (err) {
    console.error('Hireflix request failed', err);
    res.status(500).send('<h2>Error contacting Hireflix.</h2>');
    return;
  }

  const publicUrl = data?.data?.inviteCandidateToInterview?.url?.public;
  if (!publicUrl) {
    console.error('Unexpected Hireflix response', data);
    res.status(500).send('<h2>Failed to create interview.</h2>');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Preparing interview...</title>
</head>
<body>
  <h2 id="message">Checking your profile...</h2>
  <script>
    setTimeout(() => {
      document.getElementById('message').innerText = "You\u2019ll be redirected to the video interview. You can answer now or later \u2014 the link was also sent to your email.";
      setTimeout(() => {
        window.location.href = '${publicUrl}';
      }, 5000);
    }, 3000);
  </script>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
};
