import React from 'react';
import { X, Shield, Cpu, Terminal, CheckCircle2, Globe, Github } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-xl w-full p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Generic Diagnostic Tool</h3>
              <p className="text-[11px] text-cyan-400 font-mono">Tester Present Specialist Automotive Solutions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overview */}
        <div className="text-slate-300 leading-relaxed space-y-2">
          <p>
            The <strong>Generic Diagnostic Tool</strong> is an advanced vehicle diagnostics, ECU security analysis, and PassThru protocol suite designed for automotive reverse engineers, ECU tuners, and diagnostic technicians.
          </p>
          <p className="text-slate-400 text-[11px]">
            Migrated from the C#/WinForms repository into a high-performance, containerized web simulation engine that fully models UDS (ISO 14229), OBD-II (SAE J1979), KWP2000 (ISO 14230), and CAN Bus communication (ISO 11898 / ISO 15765-2).
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
            Integrated Specifications & Engines
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>ISO 14229-1 (UDS) Services Suite</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>OEM Seed-Key Calculators & Bruteforcer</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>5,800+ Diagnostic Data Identifiers (DIDs)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>1,200+ DTC Database & Symptom Bytes</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Direct Memory Read (0x23 DMR) Hex Dump</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>High-Speed CAN Bus Monitor & Injector</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>ISO 3779 Modulo-11 VIN Decoder</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>CAN Diagnostic Bus Topology Sniffer</span>
            </div>
          </div>
        </div>

        {/* Supported Manufacturers */}
        <div>
          <span className="text-slate-400 text-[11px] block mb-1 font-medium">Supported Security Key Algorithms:</span>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Ford EEC-V & PWM/CAN</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">PSA Peugeot Citroën SID</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Honda PGM-FI</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Volkswagen / Audi SA2</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Nissan NATS 5</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Fiat / Alfa Romeo Magneti Marelli</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">Version 2.4.0 (AI Studio Edition)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
