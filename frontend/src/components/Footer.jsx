import React from "react";
import { Github, Linkedin, Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative w-full bg-linear-to-b from-[#0a0f1e]/30 to-[#05070d]/80 backdrop-blur-xl border-t border-white/10">
      
      {/* TOP SECTION */}
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 text-white/90">
        
        {/* Branding */}
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-semibold text-white mb-3 tracking-wide">
            Chemistry Visualizer
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            3D molecular exploration powered by AI — visualize, animate and understand
            structures like never before.
          </p>

          {/* Socials */}
          <div className="flex items-center gap-4 mt-5">
            <a className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition" href="#">
              <Github size={18} />
            </a>
            <a className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition" href="#">
              <Linkedin size={18} />
            </a>
            <a className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition" href="#">
              <Globe size={18} />
            </a>
          </div>
        </div>

        {/* Product Links */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Product
          </h3>
          <ul className="flex flex-col gap-2 text-white/70 text-sm">
            <li><a className="hover:text-white transition" href="#">3D Viewer</a></li>
            <li><a className="hover:text-white transition" href="#">AI Modeling</a></li>
            <li><a className="hover:text-white transition" href="#">Templates</a></li>
            <li><a className="hover:text-white transition" href="#">Chemistry Tools</a></li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Resources
          </h3>
          <ul className="flex flex-col gap-2 text-white/70 text-sm">
            <li><a className="hover:text-white transition" href="#">Documentation</a></li>
            <li><a className="hover:text-white transition" href="#">Help Center</a></li>
            <li><a className="hover:text-white transition" href="#">API Reference</a></li>
            <li><a className="hover:text-white transition" href="#">Developer Tools</a></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Company
          </h3>
          <ul className="flex flex-col gap-2 text-white/70 text-sm">
            <li><a className="hover:text-white transition" href="#">About</a></li>
            <li><a className="hover:text-white transition" href="#">Team</a></li>
            <li><a className="hover:text-white transition" href="#">Privacy Policy</a></li>
            <li><a className="hover:text-white transition" href="#">Terms of Service</a></li>
          </ul>
        </div>
      </div>

    </footer>
  );
}
