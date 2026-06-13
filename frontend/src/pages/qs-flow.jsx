import { useState } from 'react';
import QSFlowModal from '../components/QSFlowModal';

export default function QSFlowPage() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <QSFlowModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
