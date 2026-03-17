import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, FolderKanban, DownloadCloud, 
  Scale, Leaf, ClipboardCheck, FileText, History, 
  Library, Settings, Search, Send, Plus, Bell 
} from 'lucide-react';
import logo from './assets/targoo.png';

const theme = {
  bg: '#f5f5f7',
  panel: '#ffffff',
  border: '#e5e7eb',
  textMain: '#111827',
  textSecondary: '#6b7280',
  accent: '#007aff',
  accentLight: 'rgba(0, 122, 255, 0.08)',
  hover: '#f0f0f2',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  radiusSm: '8px',
  radiusMd: '12px',
  radiusLg: '16px',
  transition: 'all 0.2s ease'
};

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'data', label: 'Data Import', icon: DownloadCloud },
  { id: 'materiality', label: 'Materiality', icon: Scale },
  { id: 'emissions', label: 'Emissions', icon: Leaf },
  { id: 'esrs', label: 'ESRS Status', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'audit', label: 'Audit Trail', icon: History },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'settings', label: 'Settings', icon: Settings }
];

const chatMessages = [
  { role: 'assistant', text: 'Good morning. I have analyzed Hans GmbH\'s recent utility data. Scope 2 emissions are calculated. How would you like to proceed with the ESRS E1 disclosures?' },
  { role: 'user', text: 'Can you draft the initial climate transition plan based on their 2023 baseline?' }
];

const SidebarItem = ({ item, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = item.icon;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: theme.radiusSm,
        backgroundColor: isActive ? theme.accentLight : (isHovered ? theme.hover : 'transparent'),
        color: isActive ? theme.accent : theme.textMain,
        transition: theme.transition,
        marginBottom: '4px'
      }}
    >
      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} color={isActive ? theme.accent : theme.textSecondary} />
      <span style={{ fontSize: '14px', fontWeight: isActive ? 500 : 400 }}>{item.label}</span>
    </div>
  );
};

const PrimaryButton = ({ children, icon: Icon, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 20px',
        borderRadius: theme.radiusSm,
        backgroundColor: theme.accent,
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        transition: theme.transition,
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isHovered ? '0 4px 12px rgba(0, 122, 255, 0.3)' : '0 2px 6px rgba(0, 122, 255, 0.2)'
      }}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
};

const SearchInput = () => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      backgroundColor: theme.bg,
      borderRadius: '20px',
      border: `1px solid ${isFocused ? theme.accent : theme.border}`,
      boxShadow: isFocused ? '0 0 0 3px rgba(0, 122, 255, 0.15)' : 'none',
      width: '240px',
      transition: theme.transition
    }}>
      <Search size={16} color={theme.textSecondary} />
      <input 
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Search..."
        style={{
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          color: theme.textMain,
          fontSize: '14px',
          width: '100%'
        }}
      />
    </div>
  );
};

const EmptyState = ({ activeItem }) => {
  const Icon = activeItem.icon;
  
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: theme.radiusMd,
        backgroundColor: theme.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        boxShadow: theme.shadow
      }}>
        <Icon size={32} color={theme.textSecondary} strokeWidth={1.5} />
      </div>
      <h2 style={{ 
        fontSize: '20px', 
        fontWeight: 600, 
        color: theme.textMain, 
        marginBottom: '8px' 
      }}>
        No {activeItem.label.toLowerCase()} established yet
      </h2>
      <p style={{ 
        fontSize: '14px', 
        color: theme.textSecondary, 
        maxWidth: '320px', 
        lineHeight: 1.5,
        marginBottom: '32px' 
      }}>
        Configure your initial parameters to activate the {activeItem.label.toLowerCase()} engine and begin generating compliance insights.
      </p>
      <PrimaryButton icon={Plus}>
        Create {activeItem.label}
      </PrimaryButton>
    </div>
  );
};

export default function App() {
  const [activeMenuId, setActiveMenuId] = useState('data');
  const activeItem = menuItems.find(item => item.id === activeMenuId);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      backgroundColor: theme.bg,
      color: theme.textMain,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden'
    }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{
        width: '260px',
        backgroundColor: theme.bg,
        borderRight: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo Area */}
        <div style={{
          height: '68px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <img 
            src={logo} 
            alt="targoo" 
            style={{ height: '28px', width: '28px', objectFit: 'contain' }} 
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{
            display: 'none',
            height: '28px',
            width: '28px',
            backgroundColor: theme.textMain,
            borderRadius: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>t</div>
          <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            targoo
          </span>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            color: theme.textSecondary, 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em',
            padding: '0 12px',
            marginBottom: '8px'
          }}>
            Workspace
          </div>
          {menuItems.slice(0, 4).map(item => (
            <SidebarItem 
              key={item.id} 
              item={item} 
              isActive={activeMenuId === item.id} 
              onClick={() => setActiveMenuId(item.id)} 
            />
          ))}

          <div style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            color: theme.textSecondary, 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em',
            padding: '0 12px',
            marginTop: '24px',
            marginBottom: '8px'
          }}>
            Analysis & Output
          </div>
          {menuItems.slice(4, 9).map(item => (
            <SidebarItem 
              key={item.id} 
              item={item} 
              isActive={activeMenuId === item.id} 
              onClick={() => setActiveMenuId(item.id)} 
            />
          ))}

          <div style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            color: theme.textSecondary, 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em',
            padding: '0 12px',
            marginTop: '24px',
            marginBottom: '8px'
          }}>
            System
          </div>
          {menuItems.slice(9).map(item => (
            <SidebarItem 
              key={item.id} 
              item={item} 
              isActive={activeMenuId === item.id} 
              onClick={() => setActiveMenuId(item.id)} 
            />
          ))}
        </div>

        {/* Active Client Widget */}
        <div style={{ padding: '20px' }}>
          <div style={{
            backgroundColor: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radiusMd,
            padding: '16px',
            boxShadow: theme.shadow
          }}>
            <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '6px' }}>
              Active Client
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34c759' }} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: theme.textMain }}>
                Hans GmbH Demo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1,
        backgroundColor: theme.panel,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Header */}
        <div style={{
          height: '68px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px'
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, m: 0 }}>
            {activeItem?.label}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <SearchInput />
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={20} color={theme.textSecondary} />
              <div style={{ 
                position: 'absolute', top: '-2px', right: '-2px', 
                width: '8px', height: '8px', borderRadius: '50%', 
                backgroundColor: '#ff3b30', border: '2px solid #fff' 
              }} />
            </div>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              backgroundColor: theme.bg, border: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <Users size={16} color={theme.textSecondary} />
            </div>
          </div>
        </div>

        {/* Workspace Area */}
        <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <EmptyState activeItem={activeItem} />
        </div>
      </div>

      {/* RIGHT AI PANEL */}
      <div style={{
        width: '320px',
        backgroundColor: theme.bg,
        borderLeft: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* AI Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: theme.radiusSm,
              backgroundColor: '#007aff', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', boxShadow: '0 2px 8px rgba(0, 122, 255, 0.2)'
            }}>
              <Leaf size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: theme.textMain }}>CSRD Compass AI</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34c759' }} />
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>Online & Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat History */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                backgroundColor: isUser ? theme.accent : theme.panel,
                color: isUser ? '#ffffff' : theme.textMain,
                padding: '12px 16px',
                borderRadius: theme.radiusMd,
                borderBottomRightRadius: isUser ? '4px' : theme.radiusMd,
                borderBottomLeftRadius: !isUser ? '4px' : theme.radiusMd,
                fontSize: '13px',
                lineHeight: 1.5,
                maxWidth: '85%',
                boxShadow: theme.shadow,
                border: isUser ? 'none' : `1px solid ${theme.border}`
              }}>
                {msg.text}
              </div>
            );
          })}
        </div>

        {/* Chat Input */}
        <div style={{ padding: '20px', backgroundColor: theme.panel, borderTop: `1px solid ${theme.border}` }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: '24px',
            padding: '4px 4px 4px 16px',
            transition: theme.transition
          }}>
            <input 
              placeholder="Ask about compliance..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '13px',
                color: theme.textMain
              }}
            />
            <button style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: theme.accent,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginLeft: '8px'
            }}>
              <Send size={14} color="#fff" style={{ marginLeft: '-2px' }} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
