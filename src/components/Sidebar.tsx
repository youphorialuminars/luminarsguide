'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, PlusCircle, BarChart2, Settings, LogOut, ChevronLeft, ChevronRight, Star, Video, Home, MessageSquare, Shield, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import FontSizeAdjuster from '@/components/ui/FontSizeAdjuster';


interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  activeRoute?: string;
}

const mentorNavItems = [
  { label: 'Student Dashboard', icon: Users, href: '/student-dashboard', badge: null },
  { label: 'New Session', icon: PlusCircle, href: '/new-session', badge: 'New' },
  { label: 'Analysis & History', icon: BarChart2, href: '/student-analysis-history', badge: null },
  { label: 'Student Reflections', icon: MessageSquare, href: '/mentor-reflections', badge: null },
  { label: 'Group Video Session', icon: Video, href: '/group-video-session', badge: null },
];

const studentParentNavItems = [
  { label: 'My Dashboard', icon: Home, href: '/student-parent-dashboard', badge: null },
];

const counselorNavItems = [
  { label: 'Counselor Dashboard', icon: Shield, href: '/counselor-dashboard', badge: null },
];

const schoolNavItems = [
  { label: 'School Dashboard', icon: Building2, href: '/school-dashboard', badge: null },
];

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  activeRoute,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-full border-r transition-all duration-300 ease-in-out relative"
        style={{
          width: collapsed ? '68px' : '240px',
          background: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          activeRoute={activeRoute}
          onClose={() => {}}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className="fixed top-0 left-0 z-40 flex flex-col h-full border-r lg:hidden transition-transform duration-300 ease-in-out"
        style={{
          width: '240px',
          background: 'var(--card)',
          borderColor: 'var(--border)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <SidebarContent
          collapsed={false}
          onToggleCollapse={onToggleCollapse}
          activeRoute={activeRoute}
          onClose={onCloseMobile}
          isMobile
        />
      </aside>
    </>
  );
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  activeRoute,
  onClose,
  isMobile = false,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeRoute?: string;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const router = useRouter();
  const { user, userRole, signOut } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const getRoleLabel = () => {
    if (userRole === 'student_parent') return 'Student / Parent';
    if (userRole === 'counselor') return 'Counselor';
    if (userRole === 'school') return 'School';
    return 'Mentor';
  };

  const getRoleBadgeStyle = () => {
    if (userRole === 'student_parent') return { background: '#E8F5E9', color: '#2E7D32' };
    if (userRole === 'counselor') return { background: '#EDE7F6', color: '#4527A0' };
    if (userRole === 'school') return { background: '#E3F2FD', color: '#1565C0' };
    return { background: 'var(--accent-light)', color: 'var(--primary-dark)' };
  };

  const navItems = userRole === 'student_parent'
    ? studentParentNavItems
    : userRole === 'counselor'
    ? counselorNavItems
    : userRole === 'school'
    ? schoolNavItems
    : mentorNavItems;

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/sign-up-login-screen');
      router.refresh();
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center px-4 py-4 border-b"
        style={{ borderColor: 'var(--border)', minHeight: '64px' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
            <Star size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span
              className="font-bold text-sm leading-tight truncate"
              style={{ color: 'var(--foreground)' }}
            >
              Luminar&apos;s Guide
            </span>
          )}
        </div>
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="ml-auto p-1 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
            ) : (
              <ChevronLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
            )}
          </button>
        )}
        {isMobile && (
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close navigation menu"
          >
            <ChevronLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {/* User info */}
      {!collapsed && (
        <div
          className="mx-3 mt-3 mb-1 p-3 rounded-xl"
          style={{ background: 'var(--secondary)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--gradient-primary)', color: 'white' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-600 truncate" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                {displayName}
              </p>
              <span
                className="text-xs font-600 px-1.5 py-0.5 rounded-full"
                style={{ ...getRoleBadgeStyle(), fontWeight: 600, fontSize: '10px' }}
              >
                {getRoleLabel()}
              </span>
            </div>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center mt-3 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--gradient-primary)', color: 'white' }}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Nav section label */}
      {!collapsed && (
        <p
          className="px-4 pt-4 pb-1 text-xs font-600 uppercase tracking-widest"
          style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.1em' }}
        >
          Navigation
        </p>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.href;
          return (
            <Link
              key={`nav-${item.href}`}
              href={item.href}
              onClick={onClose}
              className={`sidebar-nav-item ${isActive ? 'active' : ''} relative group`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span
                  className="text-xs font-600 px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--accent-light)',
                    color: 'var(--accent-foreground)',
                    fontWeight: 600,
                    fontSize: '11px',
                  }}
                >
                  {item.badge}
                </span>
              )}
              {collapsed && (
                <span
                  className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-500 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
                  style={{
                    background: 'var(--foreground)',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      {!collapsed && (
        <p
          className="px-4 pt-2 pb-1 text-xs font-600 uppercase tracking-widest"
          style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.1em' }}
        >
          Account
        </p>
      )}

      {/* Font Size Adjuster */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <FontSizeAdjuster />
        </div>
      )}

      <div className="px-2 pb-4 flex flex-col gap-0.5">
        <Link
          href="/settings"
          onClick={onClose}
          className="sidebar-nav-item group relative"
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Settings</span>}
          {collapsed && (
            <span
              className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
              style={{ background: 'var(--foreground)', color: 'white', fontSize: '12px' }}
            >
              Settings
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="sidebar-nav-item group relative w-full text-left"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Sign Out</span>}
          {collapsed && (
            <span
              className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
              style={{ background: 'var(--foreground)', color: 'white', fontSize: '12px' }}
            >
              Sign Out
            </span>
          )}
        </button>
      </div>
    </div>
  );
}