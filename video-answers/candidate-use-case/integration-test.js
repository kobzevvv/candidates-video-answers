"use strict";

async function main() {
  const baseUrl = process.env.FUNCTION_URL;
  if (!baseUrl) {
    console.error('FUNCTION_URL env var is required');
    process.exit(1);
  }

  const params = new URLSearchParams({
    email: 'kobzevvv+some_random_generated_hash@gmail.com',
    firstName: 'Test',
    positionId: 'test-position'
  });

  const url = `${baseUrl}?${params.toString()}`;
  console.log('Calling:', url);
  const res = await fetch(url, { redirect: 'manual' });

  if (res.status === 302) {
    const redirect = res.headers.get('location');
    console.log('Final redirect URL:', redirect);
    return;
  }

  const text = await res.text();
  const match = text.match(/<a href="(https?:[^\"]+)"[^>]*>Start video interview here<\/a>/i);
  if (match) {
    console.log('Final redirect URL:', match[1]);
  } else {
    console.log('Could not determine final redirect URL');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
