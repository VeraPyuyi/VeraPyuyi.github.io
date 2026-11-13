#!/usr/bin/env python3
"""Validate built blog cards, or fetch deployed cards with a Twitterbot user agent.

This checks our HTML and image delivery, not X's internal crawler/cache.
"""
import argparse
import json
import os
from pathlib import Path
import struct
import time
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

USER_AGENT = 'Twitterbot/1.0'
MAX_BYTES = 1_000_000


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.meta = {}
        self.canonicals = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'head':
            self.in_head = True
        if not self.in_head:
            return
        attrs = dict(attrs)
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            if key:
                self.meta.setdefault(key, []).append(attrs.get('content', ''))
        if tag == 'link' and 'canonical' in (attrs.get('rel') or '').split():
            self.canonicals.append(attrs.get('href', ''))

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False

    def one(self, key):
        values = self.meta.get(key, [])
        if len(values) != 1 or not values[0]:
            raise ValueError(f'{key}: expected one non-empty tag in <head>, got {values}')
        return values[0]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def jpeg_size(data):
    require(data[:2] == b'\xff\xd8', 'Social image is not a JPEG')
    offset = 2
    while offset < len(data):
        require(data[offset] == 255, 'Invalid JPEG marker')
        while offset < len(data) and data[offset] == 255:
            offset += 1
        require(offset < len(data), 'Truncated JPEG marker')
        marker = data[offset]
        offset += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        require(offset + 2 <= len(data), 'Truncated JPEG segment')
        length = struct.unpack('>H', data[offset:offset + 2])[0]
        require(length >= 2 and offset + length <= len(data), 'Invalid JPEG segment length')
        if marker in (0xC0, 0xC1, 0xC2):
            require(length >= 7, 'Truncated JPEG dimensions')
            height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
            return width, height
        offset += length
    raise ValueError('JPEG dimensions not found')


def get(url):
    require(urlsplit(url).scheme in ('https', 'http'), f'Invalid public URL: {url}')
    request = Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity'})
    with urlopen(request, timeout=20) as response:
        require(response.status == 200, f'{url}: HTTP {response.status}')
        return response.read(6_000_001), response.headers.get_content_type()


def local_file(dist, url):
    path = (dist / unquote(urlsplit(url).path).lstrip('/')).resolve()
    require(path.is_relative_to(dist.resolve()), f'URL escapes dist/: {url}')
    return path


def check(dist, live=None):
    if live:
        base = live.rstrip('/') + '/'
        revision = os.environ.get('GITHUB_SHA', '')
        suffix = f'?verify={revision}' if revision else ''
        raw, _ = get(urljoin(base, 'social-images.json') + suffix)
        manifest = json.loads(raw)
        if revision:
            require(manifest.get('revision') == revision, 'CDN still serves a different deployment revision')
    else:
        manifest = json.loads((dist / 'social-images.json').read_text())
        base = manifest['site'].rstrip('/') + '/'
    require(manifest.get('version') == 1, 'Unsupported social image manifest')
    require(manifest.get('pages'), 'No published blog pages in social image manifest')
    require(urlsplit(base).scheme == 'https', 'Production site URL must use HTTPS')
    require(urlsplit(base).netloc == urlsplit(manifest['site']).netloc, 'Site/deployment origin mismatch')
    robots = RobotFileParser()
    if live:
        try:
            raw, _ = get(urljoin(base, 'robots.txt'))
            robots.parse(raw.decode('utf-8').splitlines())
        except HTTPError as exc:
            if exc.code != 404:
                raise
            robots.parse([])
    else:
        robots.parse((dist / 'robots.txt').read_text().splitlines())
    checked_images = set()
    for page in manifest['pages']:
        page_url = urljoin(base, page['path'])
        require(robots.can_fetch(USER_AGENT, page_url), f'robots.txt blocks Twitterbot: {page_url}')
        if live:
            raw, mime = get(page_url)
            require(mime == 'text/html', f'{page_url}: expected HTML, got {mime}')
            html = raw.decode('utf-8')
        else:
            html = (local_file(dist, page_url) / 'index.html').read_text()
        head = Head(html)
        source_url = urljoin(base, page['image'])
        source = urlsplit(source_url)
        image = manifest['images'].get(source.path) if source.netloc == urlsplit(base).netloc else None
        expected_image = urljoin(base, image['src']) if image else source_url
        expected = {
            'twitter:card': 'summary_large_image',
            'twitter:title': page['title'],
            'og:title': page['title'],
            'og:type': 'article',
            'twitter:image': expected_image,
            'og:image': expected_image,
            'og:image:secure_url': expected_image,
            'twitter:image:alt': page['alt'],
            'og:image:alt': page['alt'],
        }
        if page.get('description'):
            expected.update({'twitter:description': page['description'], 'og:description': page['description']})
        if image:
            expected.update({'og:image:width': '1200', 'og:image:height': '630', 'og:image:type': 'image/jpeg'})
        for key, value in expected.items():
            require(head.one(key) == value, f'{page_url}: incorrect {key}: {head.one(key)!r}')
        require(len(head.canonicals) == 1, f'{page_url}: missing/duplicate canonical')
        require(head.canonicals[0].rstrip('/') == page_url.rstrip('/'), f'{page_url}: wrong canonical')
        require(head.one('og:url').rstrip('/') == page_url.rstrip('/'), f'{page_url}: wrong og:url')
        require(urlsplit(expected_image).scheme == 'https', f'Image URL must use HTTPS: {expected_image}')
        if urlsplit(expected_image).netloc == urlsplit(base).netloc:
            require(robots.can_fetch(USER_AGENT, expected_image), f'robots.txt blocks image: {expected_image}')
        if image and expected_image not in checked_images:
            if live:
                data, mime = get(expected_image)
                require(mime == 'image/jpeg', f'{expected_image}: wrong MIME type: {mime}')
            else:
                data = local_file(dist, expected_image).read_bytes()
            require(0 < len(data) < MAX_BYTES, f'{expected_image}: image exceeds site 1 MB budget')
            require(len(data) == image['bytes'], f'{expected_image}: file size differs from manifest')
            require(jpeg_size(data) == (1200, 630), f'{expected_image}: unexpected dimensions')
            checked_images.add(expected_image)
        print(f'[social] OK {page["path"]} -> {expected_image}')
    mode = 'live Twitterbot-UA fetch' if live else 'built output'
    print(f'[social] {mode}: {len(manifest["pages"])} pages, {len(checked_images)} unique JPEGs passed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=Path('dist'))
    parser.add_argument('--live', help='Public site root to check after deployment')
    parser.add_argument('--attempts', type=int, default=1)
    args = parser.parse_args()
    require(args.attempts > 0, '--attempts must be positive')
    for attempt in range(args.attempts):
        try:
            check(args.dist, args.live)
            return
        except Exception as exc:
            if not args.live or attempt + 1 == args.attempts:
                raise
            print(f'[social] deployment check {attempt + 1} failed: {exc}; retrying in 10s', flush=True)
            time.sleep(10)


if __name__ == '__main__':
    main()
