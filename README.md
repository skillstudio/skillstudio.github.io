# ImgSkills

Privacy-first professional image tools that run locally in your browser.

## Features

- Image compression, conversion, resizing, cropping, and watermarking
- PDF-to-image conversion with page selection and ZIP export
- Batch queues with per-file error isolation, cancellation, and ZIP download
- JPG, PNG, and WEBP export controls
- English and Simplified Chinese interface
- Browser-based processing for supported image workflows
- Responsive desktop, tablet, and mobile layout

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

End-to-end tests use Playwright and can be run with `npm run test:e2e` after
installing its Chromium and WebKit browsers.
