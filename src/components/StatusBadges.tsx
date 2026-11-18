import React from 'react';
import {
  EventStatus,
  FulfillmentStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  RegistrationStatus,
} from '../types';
import {
  IconAlert,
  IconBib,
  IconCheckCircle,
  IconClock,
  IconFlag,
  IconLock,
} from './Icons';

import { tx } from '../i18n';
export const EventStatusBadge: React.FC<{ status: EventStatus }> = ({
  status,
}) => {
  const map: Record<
    EventStatus,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    published: {
      label: 'เปิดรับสมัคร',
      tone: 'badge-forest',
      icon: <IconCheckCircle size={14} />,
    },
    draft: {
      label: 'แบบร่าง (ตั้งค่าไม่ครบ)',
      tone: 'badge-neutral',
      icon: <IconClock size={14} />,
    },
    in_review: {
      label: 'รอตรวจอนุมัติเผยแพร่',
      tone: 'badge-amber',
      icon: <IconClock size={14} />,
    },
    closed: {
      label: 'ปิดรับสมัคร',
      tone: 'badge-navy',
      icon: <IconLock size={14} />,
    },
    completed: {
      label: 'จบงานแล้ว · มีผล/อัลบั้ม',
      tone: 'badge-navy',
      icon: <IconFlag size={14} />,
    },
    suspended: {
      label: 'ระงับชั่วคราว',
      tone: 'badge-danger',
      icon: <IconAlert size={14} />,
    },
    cancelled: {
      label: 'ยกเลิกงาน',
      tone: 'badge-danger',
      icon: <IconAlert size={14} />,
    },
  };
  const item = map[status];
  return (
    <span className={`status-pill ${item.tone}`}>
      {tx(item.icon)}
      <span>{tx(item.label)}</span>
    </span>
  );
};

export const RegStatusBadge: React.FC<{ status: RegistrationStatus }> = ({
  status,
}) => {
  const map: Record<
    RegistrationStatus,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    confirmed: {
      label: 'ยืนยันสิทธิ์แล้ว',
      tone: 'badge-forest',
      icon: <IconCheckCircle size={14} />,
    },
    pending_payment: {
      label: 'กันโควตารอชำระ',
      tone: 'badge-amber',
      icon: <IconClock size={14} />,
    },
    cancelled: {
      label: 'ยกเลิกสิทธิ์',
      tone: 'badge-danger',
      icon: <IconAlert size={14} />,
    },
    expired: {
      label: 'หมดเวลากันโควตา',
      tone: 'badge-neutral',
      icon: <IconClock size={14} />,
    },
  };
  const item = map[status];
  return (
    <span className={`status-pill ${item.tone}`}>
      {tx(item.icon)}
      <span>{tx(item.label)}</span>
    </span>
  );
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({
  status,
}) => {
  const map: Record<
    PaymentStatus,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    succeeded: {
      label: 'ชำระเงินแล้ว',
      tone: 'badge-forest',
      icon: <IconCheckCircle size={14} />,
    },
    pending: {
      label: 'รอผลชำระ',
      tone: 'badge-amber',
      icon: <IconClock size={14} />,
    },
    failed: {
      label: 'ชำระไม่สำเร็จ',
      tone: 'badge-danger',
      icon: <IconAlert size={14} />,
    },
    expired: {
      label: 'รายการหมดอายุ',
      tone: 'badge-neutral',
      icon: <IconClock size={14} />,
    },
  };
  const item = map[status];
  return (
    <span className={`status-pill ${item.tone}`}>
      {tx(item.icon)}
      <span>{tx(item.label)}</span>
    </span>
  );
};

export const RefundStatusBadge: React.FC<{ status: RefundStatus }> = ({
  status,
}) => {
  if (status === 'none') {
    return <span className="muted-inline">{tx("ไม่มีขอคืน")}</span>;
  }
  const map: Record<
    Exclude<RefundStatus, 'none'>,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    requested: {
      label: 'รอตรวจคำขอคืนเงิน',
      tone: 'badge-amber',
      icon: <IconAlert size={14} />,
    },
    approved: {
      label: 'อนุมัติรอโอนคืน',
      tone: 'badge-navy',
      icon: <IconClock size={14} />,
    },
    processing: {
      label: 'กำลังคืนผ่าน Provider',
      tone: 'badge-navy',
      icon: <IconClock size={14} />,
    },
    succeeded: {
      label: 'คืนเงินสำเร็จแล้ว',
      tone: 'badge-danger',
      icon: <IconCheckCircle size={14} />,
    },
    rejected: {
      label: 'ปฏิเสธคำขอคืน',
      tone: 'badge-neutral',
      icon: <IconLock size={14} />,
    },
  };
  const item = map[status];
  return (
    <span className={`status-pill ${item.tone}`}>
      {tx(item.icon)}
      <span>{tx(item.label)}</span>
    </span>
  );
};

export const FulfillmentStatusBadge: React.FC<{
  status: FulfillmentStatus;
}> = ({ status }) => {
  const map: Record<
    FulfillmentStatus,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    not_ready: {
      label: 'ยังไม่พร้อมส่งมอบ',
      tone: 'badge-neutral',
      icon: <IconClock size={14} />,
    },
    ready: {
      label: 'พร้อมรับ BIB / เสื้อ',
      tone: 'badge-navy',
      icon: <IconBib size={14} />,
    },
    checked_in: {
      label: 'เช็กอินแล้ว รอรับเสื้อ',
      tone: 'badge-amber',
      icon: <IconClock size={14} />,
    },
    kit_picked_up: {
      label: 'รับอุปกรณ์ครบแล้ว',
      tone: 'badge-forest',
      icon: <IconCheckCircle size={14} />,
    },
  };
  const item = map[status];
  return (
    <span className={`status-pill ${item.tone}`}>
      {tx(item.icon)}
      <span>{tx(item.label)}</span>
    </span>
  );
};

export const PayoutStatusBadge: React.FC<{ status: PayoutStatus }> = ({
  status,
}) => {
  const map: Record<
    PayoutStatus,
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    scheduled: {
      label: 'กำหนดรอบนำส่งแล้ว',
      tone: 'badge-navy',
      icon: <IconClock size={14} />,
    },
    processing: {
      label: 'กำลังโอนนำส่ง',
      tone: 'badge-amber',
      icon: <IconClock size={14} />,
    },
    paid: {
      label: 'โอนให้ผู้จัดแล้ว',
      tone: 'badge-forest',
      icon: <IconCheckCircle size={14} />,
    },
    held: {
      label: 'พักยอดรอตรวจสอบ',
      tone: 'badge-danger',
      icon: <IconAlert size={14} />,
    },
  };
  const item = map[status];
  return (
    <span className={`status-pill ${item.tone}`}>
      {tx(item.icon)}
      <span>{tx(item.label)}</span>
    </span>
  );
};
