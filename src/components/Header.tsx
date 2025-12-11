import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, Shield, Menu, X, Sparkles, Heart, Settings, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/use-user-role';
import type { User } from '@supabase/supabase-js';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useUserRole();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const closeMenu = () => setIsMenuOpen(false);
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass-strong shadow-soft' : 'bg-background/80 backdrop-blur-md'
    }`}>
      <div className="container">
        <div className="flex items-center justify-between h-18 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group" onClick={closeMenu}>
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-emerald-light flex items-center justify-center group-hover:scale-105 transition-transform shadow-primary">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent animate-pulse-slow" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-display text-xl font-bold text-foreground leading-tight">
                Kalam <span className="text-gradient-gold">Reader</span>
              </span>
              <span className="text-[10px] text-muted-foreground -mt-0.5">islamic poetry</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive('/') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
            <Link
              to="/favorites"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive('/favorites') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Heart className="w-4 h-4" />
              Favorites
            </Link>
            <Link
              to="/settings"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive('/settings') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            {user && role === 'admin' && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive('/admin') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            {user && (role === 'uploader' || role === 'admin') && (
              <Link
                to="/uploader"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive('/uploader') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload
              </Link>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button variant="outline" onClick={handleLogout} className="hidden md:inline-flex rounded-xl h-10" size="sm">
                Logout
              </Button>
            ) : (
              <Button asChild className="hidden md:inline-flex rounded-xl h-10 bg-gradient-to-r from-primary to-emerald-light hover:opacity-90" size="sm">
                <Link to="/auth">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden rounded-xl h-10 w-10">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border/50 animate-slide-down">
            <div className="flex flex-col gap-1">
              <Link to="/" onClick={closeMenu} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive('/') ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                <Home className="w-5 h-5" />
                Home
              </Link>
              <Link to="/favorites" onClick={closeMenu} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive('/favorites') ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                <Heart className="w-5 h-5" />
                Favorites
              </Link>
              <Link to="/settings" onClick={closeMenu} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive('/settings') ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                <Settings className="w-5 h-5" />
                Settings
              </Link>
              {user ? (
                <>
                  {role === 'admin' && (
                    <Link to="/admin" onClick={closeMenu} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive('/admin') ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                      <Shield className="w-5 h-5" />
                      Admin
                    </Link>
                  )}
                  {(role === 'uploader' || role === 'admin') && (
                    <Link to="/uploader" onClick={closeMenu} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive('/uploader') ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                      <Upload className="w-5 h-5" />
                      Upload
                    </Link>
                  )}
                  <Button variant="ghost" onClick={() => { handleLogout(); closeMenu(); }} className="justify-start px-4 text-destructive hover:text-destructive">
                    Logout
                  </Button>
                </>
              ) : (
                <Link to="/auth" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground">
                  <Sparkles className="w-5 h-5" />
                  Login
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}