import React, { useState } from 'react';
import { X, Binary, Search, BookOpen } from 'lucide-react';

interface Hex2DecModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NRC_REFERENCE: Record<string, { name: string; description: string }> = {
  '10': { name: 'General Reject', description: 'ECU received service but cannot execute action for unspecified reasons.' },
  '11': { name: 'Service Not Supported', description: 'The requested service ID is not implemented or supported on this ECU.' },
  '12': { name: 'Sub-Function Not Supported', description: 'The requested sub-function parameter is not recognized.' },
  '13': { name: 'Incorrect Message Length or Invalid Format', description: 'Payload length does not match required UDS service specification.' },
  '14': { name: 'Response Too Long', description: 'Response payload exceeds buffer limits of physical transport protocol.' },
  '21': { name: 'Busy Repeat Request', description: 'ECU is currently performing a critical internal operation; retry command shortly.' },
  '22': { name: 'Conditions Not Correct', description: 'Vehicle prerequisite states (e.g. Engine Off, Park gear, Vehicle stationary) not met.' },
  '24': { name: 'Request Sequence Error', description: 'Operations executed in incorrect order (e.g. sending key before requesting seed).' },
  '31': { name: 'Request Out Of Range', description: 'Parameter data identifier (DID), memory address, or routine ID not found in ECU memory map.' },
  '33': { name: 'Security Access Denied', description: 'Requested service requires active security unlock via 0x27 Seed-Key handshake.' },
  '35': { name: 'Invalid Key', description: 'The security key computed and supplied by client did not match internal ECU key.' },
  '36': { name: 'Exceeded Number of Attempts', description: 'Too many incorrect security key attempts. Security access locked out temporarily.' },
  '37': { name: 'Required Time Delay Not Expired', description: 'ECU security lock-out timer is active. Must wait before attempting new keys.' },
  '70': { name: 'Upload / Download Not Accepted', description: 'Memory transfer parameters or address region rejected by bootloader.' },
  '71': { name: 'Transfer Data Suspended', description: 'Active data block transfer interrupted or aborted.' },
  '72': { name: 'General Programming Failure', description: 'Flash erase or byte-write failed at physical flash memory hardware level.' },
  '78': { name: 'Request Correctly Received - Response Pending', description: 'ECU has acknowledged command and is processing; client must wait for completion.' },
  '7E': { name: 'Sub-Function Not Supported In Active Session', description: 'Sub-function valid only in Extended (0x03) or Programming (0x02) session.' },
  '7F': { name: 'Service Not Supported In Active Session', description: 'Diagnostic service restricted to specific privileged diagnostic sessions.' }
};

export const Hex2DecModal: React.FC<Hex2DecModalProps> = ({ isOpen, onClose }) => {
  const [hexValue, setHexValue] = useState<string>('7E0');
  const [decValue, setDecValue] = useState<string>('2016');
  const [binValue, setBinValue] = useState<string>('0111 1110 0000');
  const [nrcSearch, setNrcSearch] = useState<string>('');

  if (!isOpen) return null;

  const handleHexChange = (hex: string) => {
    const clean = hex.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    setHexValue(clean);
    if (!clean) {
      setDecValue('');
      setBinValue('');
      return;
    }
    try {
      const num = parseInt(clean, 16);
      setDecValue(num.toString(10));
      setBinValue(num.toString(2).padStart(Math.ceil(num.toString(2).length / 4) * 4, '0').match(/.{1,4}/g)?.join(' ') || '');
    } catch {
      // ignore
    }
  };

  const handleDecChange = (dec: string) => {
    const clean = dec.replace(/[^0-9]/g, '');
    setDecValue(clean);
    if (!clean) {
      setHexValue('');
      setBinValue('');
      return;
    }
    try {
      const num = parseInt(clean, 10);
      setHexValue(num.toString(16).toUpperCase());
      setBinValue(num.toString(2).padStart(Math.ceil(num.toString(2).length / 4) * 4, '0').match(/.{1,4}/g)?.join(' ') || '');
    } catch {
      // ignore
    }
  };

  const filteredNrc = Object.entries(NRC_REFERENCE).filter(([code, item]) => 
    code.toLowerCase().includes(nrcSearch.toLowerCase()) ||
    item.name.toLowerCase().includes(nrcSearch.toLowerCase()) ||
    item.description.toLowerCase().includes(nrcSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full p-5 shadow-2xl text-xs space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Binary className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Hexadecimal / Decimal Converter & NRC Reference</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Converter Panel */}
        <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
            Base Converter (Hex / Dec / Bin)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 text-[11px] block mb-1">Hexadecimal (0x):</label>
              <input
                type="text"
                value={hexValue}
                onChange={(e) => handleHexChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-cyan-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 text-[11px] block mb-1">Decimal (Dec):</label>
              <input
                type="text"
                value={decValue}
                onChange={(e) => handleDecChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-200 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 text-[11px] block mb-1">Binary (Bin):</label>
              <input
                type="text"
                readOnly
                value={binValue}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-amber-300 font-mono font-bold select-all"
              />
            </div>
          </div>
        </div>

        {/* NRC Reference Guide */}
        <div className="flex-1 overflow-hidden flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Negative Response Code (NRC 0x7F) Dictionary</span>
            </div>

            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
              <input
                type="text"
                value={nrcSearch}
                onChange={(e) => setNrcSearch(e.target.value)}
                placeholder="Filter NRC..."
                className="bg-slate-950 border border-slate-700 rounded pl-7 pr-2 py-0.5 text-xs text-slate-200 focus:outline-none w-36"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-slate-950/80">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2 px-3">NRC Hex</th>
                  <th className="py-2 px-3">Code Designation</th>
                  <th className="py-2 px-3">Standard Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredNrc.map(([code, item]) => (
                  <tr key={code} className="hover:bg-slate-900/40">
                    <td className="py-2 px-3 font-mono font-bold text-rose-400 whitespace-nowrap">
                      0x{code}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-200 whitespace-nowrap">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {item.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
