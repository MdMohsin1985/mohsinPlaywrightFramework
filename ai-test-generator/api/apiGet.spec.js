import { test, expect, request } from '@playwright/test';

test('GET posts', async ({ request }) => {
  const response = await request.get('https://jsonplaceholder.typicode.com/posts/1');
  const body = await response.json();
  console.log(body.body);
  expect(response.status()).toBe(400);
  
  expect(body.id).toBe(1);
  expect(body.userId).toBe(1);
  expect(body.body).toContain('quia et suscipit');

});

test('GET products', async ({ request }) => {
  const response = await request.get('https://dummyjson.com/products/1');
  const body = await response.json();
  console.log(body.body);
  expect(response.ok()).toBeTruthy();

  expect(body.id).toBe(1);
  expect(body.title).toBeTruthy();
  console.log(body);

});
