import { expect, test } from '@playwright/test';

// Same self-signed EC test certificate as in certificate-parser.fixtures.ts (Playwright cannot import it directly)
const ecCertificatePem = `-----BEGIN CERTIFICATE-----
MIIByTCCAXCgAwIBAgIUG/5L82t7s4fkfUe9bgpkYzziNHUwCgYIKoZIzj0EAwIw
KjEXMBUGA1UEAwwOZWMuZXhhbXBsZS5jb20xDzANBgNVBAoMBkVDIE9yZzAeFw0y
NjA5MjExNDU3MzhaFw0yNjEwMjExNDU3MzhaMCoxFzAVBgNVBAMMDmVjLmV4YW1w
bGUuY29tMQ8wDQYDVQQKDAZFQyBPcmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AATV3y02svq8L38ZtLUHVRPEFBKkRgc1zSlkSEZhDTFNIfLIm2LzR9Cf1oSViZjp
SJplqKZwQo+mObOQrezUQ7Lho3QwcjAdBgNVHQ4EFgQUfBI8+lNuvs67D2oWiiUE
Jrc1qvgwHwYDVR0jBBgwFoAUfBI8+lNuvs67D2oWiiUEJrc1qvgwDwYDVR0TAQH/
BAUwAwEB/zAfBgNVHREEGDAWgg5lYy5leGFtcGxlLmNvbYcEwKgBATAKBggqhkjO
PQQDAgNHADBEAiBt6Ntu3LhsM6jtUkdH8ooYkNnBYn1jzynxrkUw6QQ48QIgIqsy
JA/PgB+2MPwkm8YRmeXBoyc9qoJw0p6IXNlYCCo=
-----END CERTIFICATE-----`;

test.describe('Tool - Certificate parser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/certificate-parser');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('X.509 certificate parser - IT Tools');
  });

  test('Parses a pasted certificate', async ({ page }) => {
    await page.getByTestId('certificate-input').fill(ecCertificatePem);
    const card = page.getByTestId('certificate-0');
    await expect(card).toContainText('ec.example.com');
    await expect(card).toContainText('ECDSA with SHA-256');
    await expect(card).toContainText('DNS:ec.example.com');
  });
});
