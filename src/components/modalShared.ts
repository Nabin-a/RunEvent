import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { tx } from '../i18n';

/** Close an edit dialog, asking first when it holds unsaved edits. */
export const confirmDiscardClose = (isDirty: boolean, doClose: () => void) => {
  if (!isDirty) {
    doClose();
    return;
  }
  void Swal.fire({
    icon: 'warning',
    title: tx('ยังไม่ได้บันทึกข้อมูล'),
    text: tx('คุณมีการกรอกหรือแก้ไขข้อมูลค้างอยู่ ต้องการละทิ้งข้อมูลและปิดหน้าต่างนี้หรือไม่?'),
    showCancelButton: true,
    confirmButtonText: tx('ละทิ้งข้อมูล'),
    cancelButtonText: tx('กลับไปแก้ไขต่อ'),
    reverseButtons: true,
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    customClass: {
      container: 'kratai-swal-top',
      popup: 'kratai-swal-popup',
      actions: 'kratai-swal-actions',
      confirmButton: 'btn-primary kratai-swal-discard-btn',
      cancelButton: 'btn-secondary',
    },
  }).then((res) => {
    if (res.isConfirmed) doClose();
  });
};

/** Escape runs `close` while the dialog is mounted (not while a SweetAlert is on top). */
export const useEscapeToClose = (close: () => void) => {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || Swal.isVisible()) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};
