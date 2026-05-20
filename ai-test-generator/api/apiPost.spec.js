import { test, expect } from '@playwright/test';

test('POST create new post', async ({ request }) => {

  const response = await request.post(
    'https://jsonplaceholder.typicode.com/posts',
    {
      data: {
        title: 'Playwright API Testing',
        body: 'Learning POST API automation',
        userId: 1
      }
    }
  );

  // Verify status code
  expect(response.status()).toBe(400);

  // Convert response to JSON
  const body = await response.json();

  console.log(body);

  // Assertions
  expect(body.title).toBe('Playwright API Testing');
  expect(body.body).toBe('Learning POST API automation');
  expect(body.userId).toBe(1);
});