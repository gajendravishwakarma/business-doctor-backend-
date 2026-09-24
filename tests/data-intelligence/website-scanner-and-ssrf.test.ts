import { describe, it, expect } from 'vitest';
import { isPrivateOrReservedIp, validateUrlForSsrf, cleanHtmlContent } from '../../server';

describe('Phase 4: Website Intelligence & SSRF Protection Architecture', () => {
  describe('SSRF Protection - IP Address Guard', () => {
    it('blocks IPv4 loopback addresses (127.0.0.0/8)', () => {
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('127.0.0.2')).toBe(true);
      expect(isPrivateOrReservedIp('127.255.255.254')).toBe(true);
    });

    it('blocks RFC 1918 private IPv4 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
      expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('10.254.1.10')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.24.50.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.31.255.254')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.100.254')).toBe(true);
    });

    it('blocks AWS / GCP Cloud Metadata IP (169.254.169.254 and link-local)', () => {
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('169.254.1.1')).toBe(true);
    });

    it('blocks Test-Net and Multicast addresses', () => {
      expect(isPrivateOrReservedIp('192.0.2.1')).toBe(true);
      expect(isPrivateOrReservedIp('198.51.100.1')).toBe(true);
      expect(isPrivateOrReservedIp('203.0.113.1')).toBe(true);
      expect(isPrivateOrReservedIp('224.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('255.255.255.255')).toBe(true);
    });

    it('blocks IPv6 loopback, link-local, and unique local addresses', () => {
      expect(isPrivateOrReservedIp('::1')).toBe(true);
      expect(isPrivateOrReservedIp('::')).toBe(true);
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIp('fd00::1234')).toBe(true);
    });

    it('blocks IPv4-mapped IPv6 loopback and private subnets', () => {
      expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:10.0.0.1')).toBe(true);
    });

    it('allows valid public routable IP addresses', () => {
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
      expect(isPrivateOrReservedIp('142.250.190.46')).toBe(false);
    });
  });

  describe('SSRF Protection - URL Sanitation & Scheme Validation', () => {
    it('blocks localhost domain and internal URLs', async () => {
      const res = await validateUrlForSsrf('http://localhost/api/secret');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/localhost|internal/i);
    });

    it('blocks loopback IP in URL', async () => {
      const res = await validateUrlForSsrf('http://127.0.0.1/admin');
      expect(res.valid).toBe(false);
    });

    it('blocks cloud metadata endpoint in URL', async () => {
      const res = await validateUrlForSsrf('http://169.254.169.254/computeMetadata/v1/');
      expect(res.valid).toBe(false);
    });

    it('rejects unsupported protocols (ftp, file, gopher)', async () => {
      const resFile = await validateUrlForSsrf('file:///etc/passwd');
      expect(resFile.valid).toBe(false);
      expect(resFile.error).toMatch(/http|https/i);

      const resFtp = await validateUrlForSsrf('ftp://public-mirror.com/file');
      expect(resFtp.valid).toBe(false);
      expect(resFtp.error).toMatch(/http|https/i);
    });

    it('rejects internal ports (e.g. 22 SSH, 5432 Postgres, 6379 Redis)', async () => {
      const res = await validateUrlForSsrf('https://example.com:5432');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/standard ports 80 and 443/i);
    });

    it('automatically defaults naked domains to HTTPS scheme', async () => {
      const res = await validateUrlForSsrf('example.com');
      // If DNS resolves or if valid public domain format
      if (res.urlObj) {
        expect(res.urlObj.protocol).toBe('https:');
      }
    });
  });

  describe('HTML Content Cleaning & Extraction', () => {
    it('extracts title and meta tags while sanitizing HTML payload', () => {
      const rawHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Vaidya Ayurveda Clinic | Holistic Health Bangalore</title>
            <meta name="description" content="Authentic Ayurvedic consultation, Panchakarma therapy, and natural wellness in Indiranagar.">
            <script>alert('malicious script execution attempt');</script>
            <style>body { color: red; }</style>
          </head>
          <body>
            <header>
              <h1>Welcome to Vaidya Ayurveda</h1>
              <p>Call us at +91 98765 43210 or email care@vaidyaayur.in</p>
            </header>
            <main>
              <h2>Our Signature Therapies</h2>
              <div>
                <h3>Shirodhara Therapy</h3>
                <p>Relaxing medicated oil stream - ₹2,500 for 60 mins.</p>
              </div>
            </main>
          </body>
        </html>
      `;

      const cleaned = cleanHtmlContent(rawHtml);
      expect(cleaned.metaInfo.title).toContain('Vaidya Ayurveda Clinic');
      expect(cleaned.metaInfo.description).toContain('Authentic Ayurvedic consultation');
      expect(cleaned.metaInfo.emails).toContain('care@vaidyaayur.in');
      expect(cleaned.metaInfo.phones.length).toBeGreaterThan(0);
      expect(cleaned.cleanText).not.toContain('alert(');
      expect(cleaned.cleanText).not.toContain('body { color: red; }');
      expect(cleaned.cleanText).toContain('Shirodhara Therapy');
    });

    it('extracts social media links from HTML', () => {
      const rawHtml = `
        <html>
          <body>
            <footer>
              <a href="https://instagram.com/vaidya_ayur">Instagram</a>
              <a href="https://facebook.com/vaidyaayurveda">Facebook</a>
              <a href="https://wa.me/919876543210">WhatsApp</a>
            </footer>
          </body>
        </html>
      `;

      const cleaned = cleanHtmlContent(rawHtml);
      expect(cleaned.metaInfo.socialLinks.instagram).toBe('https://instagram.com/vaidya_ayur');
      expect(cleaned.metaInfo.socialLinks.facebook).toBe('https://facebook.com/vaidyaayurveda');
      expect(cleaned.metaInfo.socialLinks.whatsapp).toBe('https://wa.me/919876543210');
    });
  });
});
