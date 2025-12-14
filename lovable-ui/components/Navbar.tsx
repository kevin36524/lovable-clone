'use client';

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function Navbar() {
  const { user, isLoading, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
      {/* Logo & main navigation */}
      <div className="flex items-center gap-10">
        <a
          href="/"
          className="flex items-center gap-2 text-2xl font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {/* Simple gradient square logo */}
          <span className="inline-block w-6 h-6 rounded-sm bg-gradient-to-br from-orange-400 via-pink-500 to-blue-500" />
          Hackable
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-gray-300">
          <a href="#" className="hover:text-white transition-colors">
            Community
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Enterprise
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Learn
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Shipped
          </a>
        </div>
      </div>

      {/* Auth buttons */}
      <div className="flex items-center gap-4 text-sm">
        {isLoading ? (
          <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                  {user.name[0].toUpperCase()}
                </div>
              )}
              <span className="text-white hidden md:inline">{user.name}</span>
            </button>

            {showDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                {/* Dropdown menu */}
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-2 z-20">
                  <div className="px-4 py-2 text-gray-400 text-xs border-b border-gray-800 truncate">
                    {user.email}
                  </div>
                  <button
                    onClick={signOut}
                    className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/login?redirect=/generate"
              className="px-4 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
