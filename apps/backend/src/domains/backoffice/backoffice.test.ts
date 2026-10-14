import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertAdminView, toPostgrestQuery } from './backoffice.admin.controller';

describe('toPostgrestQuery (admin views)', () => {
  it('builds eq / in / order / limit', () => {
    expect(toPostgrestQuery({ status: 'APPROVED', order: 'score.desc' })).toBe('select=*&status=eq.APPROVED&order=score.desc&limit=1000');
    expect(decodeURIComponent(toPostgrestQuery({ status: 'PENDING_REVIEW,DRAFT', limit: '50' }))).toBe(
      'select=*&status=in.("PENDING_REVIEW","DRAFT")&limit=50',
    );
  });
  it('rejects unsafe input', () => {
    expect(() => toPostgrestQuery({ 'role;drop': 'x' })).toThrow(BadRequestException);
    expect(() => toPostgrestQuery({ order: 'name; select' })).toThrow(BadRequestException);
    expect(() => toPostgrestQuery({ limit: '99999' })).toThrow(BadRequestException);
    expect(() => toPostgrestQuery({ status: ['a', 'b'] })).toThrow(BadRequestException);
  });
  it('encodes values so they cannot add PostgREST params', () => {
    expect(toPostgrestQuery({ name: 'a&role=eq.ADMIN' })).toContain('name=eq.a%26role%3Deq.ADMIN');
  });
});

describe('assertAdminView (admin views)', () => {
  it('rejects unknown views', () => {
    expect(() => assertAdminView('users', 'ADMIN')).toThrow(BadRequestException);
  });
  it('lets admins read normal views — audit log is filtered by the DB instead', () => {
    expect(() => assertAdminView('admin_bookings', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_audit_logs', 'ADMIN')).not.toThrow();
  });
  it('keeps commission (billing) views for super admins only', () => {
    expect(() => assertAdminView('admin_billing_events', 'ADMIN')).toThrow(ForbiddenException);
    expect(() => assertAdminView('admin_billing_events', 'SUPER_ADMIN')).not.toThrow();
  });
  it('lets admins read the bar blacklist (not a Super Admin view)', () => {
    expect(() => assertAdminView('admin_bar_blacklist', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_bar_blacklist', 'SUPER_ADMIN')).not.toThrow();
  });
  it('lets every admin read the safety checklist and inspection history (Inspector = any admin)', () => {
    expect(() => assertAdminView('admin_bar_safety', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_safety_inspections', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_safety_queue', 'ADMIN')).not.toThrow();
  });
  it('lets every admin read shop details, styles and ranking (admin tools)', () => {
    expect(() => assertAdminView('admin_bar_details', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_styles', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_ranking', 'ADMIN')).not.toThrow();
  });
  it('lets every admin read online payments and unmatched webhooks (not Super Admin views)', () => {
    expect(() => assertAdminView('admin_payment_intents', 'ADMIN')).not.toThrow();
    expect(() => assertAdminView('admin_payment_unmatched', 'ADMIN')).not.toThrow();
  });
});
