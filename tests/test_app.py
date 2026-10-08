import io
import os
import re
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ.update(DISABLE_SYNC='true', COOKIE_SECURE='false',
                  SECRET_KEY='test-only-' + 'x' * 40, DASHBOARD_PASSWORD='test-only-password-12345')
import app as service
from openpyxl import Workbook


def workbook_bytes(sheet='Sample Trial Record'):
    book = Workbook()
    book.active.title = sheet
    book.active.append(['Request No.', 'Trial Result / Feedback'])
    book.active.append(['DEMO-001', 'Synthetic test value'])
    target = io.BytesIO()
    book.save(target)
    return target.getvalue()


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.client = service.app.test_client()
        service.snapshot = None
        service.failures.clear()
        with service.lock:
            service.state.update(connected=False, digest=None, last_success=None, error='not_configured')

    def login(self):
        page = self.client.get('/login').data.decode()
        csrf = re.search(r'name="csrf" value="([^"]+)"', page)[1]
        return self.client.post('/login', data={'csrf': csrf, 'password': 'test-only-password-12345'})

    def test_private_routes_require_authentication(self):
        for route in ['/', '/en', '/th', '/live.js']:
            self.assertEqual(self.client.get(route).status_code, 302)
        for route in ['/api/status', '/api/workbook']:
            self.assertEqual(self.client.get(route).status_code, 401)
        self.assertEqual(self.client.get('/healthz').status_code, 200)
        self.assertEqual(self.client.get('/storage/rclone.conf').status_code, 404)

    def test_csrf_login_and_cookie(self):
        self.assertEqual(self.client.post('/login', data={'password':'test-only-password-12345'}).status_code, 400)
        response = self.login()
        self.assertEqual(response.status_code, 302)
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', response.headers['Set-Cookie'])
        for route in ['/en', '/th']:
            response = self.client.get(route)
            self.assertEqual(response.status_code, 200)
            response.close()
        self.assertEqual(self.client.get('/api/status').headers['Cache-Control'], 'no-store')
        self.assertEqual(self.client.post('/logout', data={'csrf':'incorrect'}).status_code, 400)
        csrf = self.client.get('/api/status').json['csrf']
        self.assertEqual(self.client.post('/logout', data={'csrf':csrf}).status_code, 302)
        self.assertEqual(self.client.get('/api/workbook').status_code, 401)

    def test_unconfigured_access_fails_closed(self):
        with patch.object(service, 'PASSWORD_HASH', None):
            self.assertEqual(self.client.get('/').status_code, 503)
            self.assertEqual(self.client.get('/api/workbook').status_code, 503)

    def test_worksheet_validation(self):
        service.validate_workbook(workbook_bytes())
        with self.assertRaises(ValueError):
            service.validate_workbook(workbook_bytes('Wrong sheet'))

    def test_sync_snapshot_and_failure_keeps_good_data(self):
        data = workbook_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            config = directory / 'rclone.conf'
            config.write_text('[onedrive]\ntype = onedrive\n')
            def download(args, **kwargs):
                self.assertEqual(args[:3], ['rclone', 'copyto', 'onedrive:Trials/Record.xlsx'])
                self.assertNotIn('shell', kwargs)
                Path(args[3]).write_bytes(data)
                return SimpleNamespace(returncode=0)
            with patch.object(service, 'DATA', directory), patch.object(service, 'CONFIG', config), patch.object(service, 'FILE_PATH', 'Trials/Record.xlsx'):
                with patch.object(service.subprocess, 'run', side_effect=download):
                    service.sync_once()
                self.assertTrue(service.state['connected'])
                self.assertEqual(service.snapshot, data)
                self.assertFalse((directory / 'incoming.xlsx').exists())
                self.login()
                response = self.client.get('/api/workbook')
                self.assertEqual(response.data, data)
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                digest = service.state['digest']
                with patch.object(service.subprocess, 'run', side_effect=RuntimeError('sensitive error must not escape')):
                    service.sync_once()
                self.assertEqual(service.snapshot, data)
                self.assertEqual(service.state['digest'], digest)
                self.assertEqual(service.state['error'], 'sync_failed')
                self.assertNotIn('sensitive', str(self.client.get('/api/status').json))


if __name__ == '__main__':
    unittest.main()
