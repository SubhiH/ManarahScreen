# Public Slides API

When **Custom API** is selected as the slide source, ManarahScreen fetches slides from a publicly accessible HTTPS endpoint.

## Response format

```json
{
  "version": "1",
  "updatedAt": "2026-08-02T15:30:00Z",
  "slides": [
    {
      "id": "eid-dinner-2026",
      "name": "Community Eid Dinner",
      "url": "https://example.org/slides/eid-dinner.jpg",
      "kind": "image",
      "duration": 10,
      "sortOrder": 1,
      "enabled": true,
      "display": "Screen,Website",
      "displayTargets": ["Screen", "Website"],
      "startDate": "2026-08-01",
      "endDate": "2026-08-15",
      "updatedAt": "2026-08-02T15:20:00Z"
    }
  ]
}
```

## Requirements

- `id`, `url`, and `kind` (`image` or `video`) are required.
- A slide is imported only when `displayTargets` contains `Screen`. If
  `displayTargets` is omitted, the comma-separated `display` field is used.
- `duration` is in seconds, defaults to 10, and has a minimum of 3.
- `sortOrder`, `enabled`, `startDate`, and `endDate` are optional.
- Dates use `YYYY-MM-DD` and are inclusive in the masjid's configured timezone.
- Media URLs must be public HTTPS links returning the file directly.
- Supported images: JPG, PNG, WebP, GIF, and BMP.
- Supported videos: MP4 and WebM; MP4/H.264 is recommended.
- Recommended slide size: **1920 x 1080 (16:9)**.
- Use `updatedAt`, a checksum, or a new media URL whenever slide content changes so cached files refresh.
