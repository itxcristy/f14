import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, FolderOpen, FileText, Loader2, ChevronLeft, Upload, Image, Users, Languages, Maximize2, ZoomIn, ZoomOut, X as XIcon, Scissors, UserCog, Shield, Key } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/use-user-role';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import type { Category, Piece, Imam, UserProfile, UploaderPermission } from '@/lib/supabase-types';

export default function AdminPage() {
  const navigate = useNavigate();
  const { role: currentRole } = useUserRole();
  const [categories, setCategories] = useState<Category[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [imams, setImams] = useState<Imam[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('Hinglish');
  const [targetLanguage, setTargetLanguage] = useState('Urdu');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // User Management
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userForm, setUserForm] = useState({ role: 'user' as 'admin' | 'uploader' | 'user' });
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userPermissions, setUserPermissions] = useState<UploaderPermission[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedImams, setSelectedImams] = useState<string[]>([]);

  // Category Dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '' });

  // Piece Dialog
  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [pieceForm, setPieceForm] = useState({
    title: '',
    category_id: '',
        imam_id: '',
    reciter: '',
    language: 'Urdu',
    text_content: '',
    audio_url: '',
    video_url: '',
    image_url: '',
  });

  // Imam Dialog
  const [imamDialogOpen, setImamDialogOpen] = useState(false);
  const [editingImam, setEditingImam] = useState<Imam | null>(null);
  const [imamForm, setImamForm] = useState({ name: '', slug: '', description: '', title: '' });

  // Delete Dialog
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'category' | 'piece' | 'imam'; id: string } | null>(null);

  useEffect(() => {
    checkAuth();
  }, [currentRole]);

  useEffect(() => {
    if (currentRole === 'admin') {
      fetchData();
    }
  }, [currentRole]);

  const checkAuth = async () => {
    if (currentRole !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'Only admins can access this page.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const fetchData = async () => {
    try {
      const [catRes, pieceRes, imamRes, usersRes] = await Promise.all([
        safeQuery(async () => await supabase.from('categories').select('*').order('name')),
        safeQuery(async () => await supabase.from('pieces').select('*').order('created_at', { ascending: false })),
        safeQuery(async () => await supabase.from('imams').select('*').order('order_index, name')),
        safeQuery(async () => await (supabase as any).from('profiles').select('*').order('created_at', { ascending: false })),
      ]);

      if (catRes.error) {
        logger.error('Error fetching categories:', catRes.error);
        toast({ title: 'Error', description: 'Failed to load categories', variant: 'destructive' });
      } else if (catRes.data) {
        setCategories(catRes.data as Category[]);
      }

      if (pieceRes.error) {
        logger.error('Error fetching pieces:', pieceRes.error);
        toast({ title: 'Error', description: 'Failed to load pieces', variant: 'destructive' });
      } else if (pieceRes.data) {
        setPieces(pieceRes.data as Piece[]);
      }

      if (imamRes.error) {
        logger.error('Error fetching imams:', imamRes.error);
        toast({ title: 'Error', description: 'Failed to load imams', variant: 'destructive' });
      } else if (imamRes.data) {
        setImams(imamRes.data as Imam[]);
      }

      if (usersRes.error) {
        logger.error('Error fetching users:', usersRes.error);
        toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
      } else if (usersRes.data) {
        setUserProfiles(usersRes.data as UserProfile[]);
      }
    } catch (error) {
      logger.error('Unexpected error in fetchData:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Image upload
  const handleImageUpload = async (file: File) => {
    if (!file) return null;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({ 
        title: 'Error', 
        description: 'Invalid file type. Please upload an image (JPEG, PNG, WebP, or GIF)', 
        variant: 'destructive' 
      });
      return null;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({ 
        title: 'Error', 
        description: 'File too large. Maximum size is 10MB', 
        variant: 'destructive' 
      });
      return null;
    }
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      logger.debug('Uploading image:', { fileName, size: file.size, type: file.type });
      
      const { data, error } = await supabase.storage
        .from('piece-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });
      
      if (error) {
        logger.error('Image upload error:', error);
        
        if (error.message?.includes('Bucket not found')) {
          toast({ 
            title: 'Error', 
            description: 'Storage bucket not found. Please contact an administrator.', 
            variant: 'destructive' 
          });
        } else if (error.message?.includes('new row violates row-level security')) {
          toast({ 
            title: 'Error', 
            description: 'Permission denied. You may not have permission to upload images.', 
            variant: 'destructive' 
          });
        } else {
          toast({ 
            title: 'Error', 
            description: error.message || 'Failed to upload image. Please try again.', 
            variant: 'destructive' 
          });
        }
        return null;
      }
      
      if (!data?.path) {
        logger.error('Upload succeeded but no path returned');
        toast({ 
          title: 'Error', 
          description: 'Upload succeeded but failed to get image URL', 
          variant: 'destructive' 
        });
        return null;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('piece-images')
        .getPublicUrl(data.path);
      
      logger.debug('Image uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      logger.error('Unexpected error during image upload:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'An unexpected error occurred during upload', 
        variant: 'destructive' 
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await handleImageUpload(file);
    if (url) {
      setPieceForm(f => ({ ...f, image_url: url }));
      toast({ title: 'Success', description: 'Image uploaded' });
    }
  };

  // Add break point function
  const addBreakPoint = () => {
    const textarea = document.getElementById('piece-text') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = pieceForm.text_content;
    const beforeText = text.substring(0, start);
    const afterText = text.substring(end);
    
    // Insert break marker at cursor position
    const newText = beforeText + '\n\n||BREAK||\n\n' + afterText;
    setPieceForm(f => ({ ...f, text_content: newText }));
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 12, start + 12);
    }, 0);
    
    toast({ title: 'Break point added', description: 'Paragraph break marker inserted' });
  };

  // Translate function with language support
  const translateText = async () => {
    if (!pieceForm.text_content.trim()) {
      toast({ title: 'Error', description: 'Enter text to translate', variant: 'destructive' });
      return;
    }

    setTranslating(true);
    try {
      logger.debug('Translating text', { sourceLanguage, targetLanguage, textLength: pieceForm.text_content.length });
      
      const { data, error } = await supabase.functions.invoke('translate', {
        body: { 
          text: pieceForm.text_content,
          sourceLanguage,
          targetLanguage
        },
      });

      if (error) {
        logger.error('Translation function error:', error);
        
        // Provide more specific error messages
        if (error.message?.includes('CORS') || error.message?.includes('Failed to send')) {
          toast({ 
            title: 'Translation Error', 
            description: 'Translation service is unavailable. Please try again later or contact support.', 
            variant: 'destructive' 
          });
        } else {
          throw error;
        }
        return;
      }
      
      if (data?.error) {
        logger.error('Translation API error:', data.error);
        toast({ 
          title: 'Translation Error', 
          description: data.error || 'Translation failed', 
          variant: 'destructive' 
        });
        return;
      }

      if (data?.translatedText) {
        // Clean up break markers (convert ||BREAK|| to double newlines)
        const cleanedText = data.translatedText.replace(/\|\|BREAK\|\|/g, '\n\n');
        setPieceForm(f => ({ ...f, text_content: cleanedText }));
        toast({ title: 'Success', description: `Text translated to ${targetLanguage}` });
        logger.debug('Translation successful');
      } else {
        logger.warn('Translation returned no text');
        toast({ 
          title: 'Warning', 
          description: 'Translation completed but no text was returned', 
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      logger.error('Translation error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Translation failed. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setTranslating(false);
    }
  };

  // Category functions
  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', slug: '', description: '' });
    }
    setCategoryDialogOpen(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name || !categoryForm.slug) {
      toast({ title: 'Error', description: 'Name and slug are required', variant: 'destructive' });
      return;
    }

    const data = {
      name: categoryForm.name,
      slug: categoryForm.slug.toLowerCase().replace(/\s+/g, '-'),
      description: categoryForm.description || null,
    };

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update(data)
        .eq('id', editingCategory.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Category updated' });
    } else {
      const { error } = await supabase.from('categories').insert([data]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Category created' });
    }

    setCategoryDialogOpen(false);
    fetchData();
  };

  // Imam functions
  const openImamDialog = (imam?: Imam) => {
    if (imam) {
      setEditingImam(imam);
      setImamForm({
        name: imam.name,
        slug: imam.slug,
        description: imam.description || '',
        title: imam.title || '',
      });
    } else {
      setEditingImam(null);
      setImamForm({ name: '', slug: '', description: '', title: '' });
    }
    setImamDialogOpen(true);
  };

  const saveImam = async () => {
    if (!imamForm.name || !imamForm.slug) {
      toast({ title: 'Error', description: 'Name and slug are required', variant: 'destructive' });
      return;
    }

    const data = {
      name: imamForm.name,
      slug: imamForm.slug.toLowerCase().replace(/\s+/g, '-'),
      description: imamForm.description || null,
      title: imamForm.title || null,
    };

    if (editingImam) {
      const { error } = await supabase
        .from('imams')
        .update(data)
        .eq('id', editingImam.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Imam updated' });
    } else {
      const { error } = await supabase.from('imams').insert([data]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Imam created' });
    }

    setImamDialogOpen(false);
    fetchData();
  };

  // Piece functions
  const openPieceDialog = (piece?: Piece) => {
    if (piece) {
      setEditingPiece(piece);
      setPieceForm({
        title: piece.title,
        category_id: piece.category_id,
        imam_id: piece.imam_id || '',
        reciter: piece.reciter || '',
        language: piece.language,
        text_content: piece.text_content,
        audio_url: piece.audio_url || '',
        video_url: piece.video_url || '',
        image_url: piece.image_url || '',
      });
    } else {
      setEditingPiece(null);
      setPieceForm({
        title: '',
        category_id: categories[0]?.id || '',
        imam_id: '',
        reciter: '',
        language: 'Urdu',
        text_content: '',
        audio_url: '',
        video_url: '',
        image_url: '',
      });
    }
    setPieceDialogOpen(true);
  };

  const savePiece = async () => {
    if (!pieceForm.title || !pieceForm.category_id || !pieceForm.text_content) {
      toast({ title: 'Error', description: 'Title, category, and text are required', variant: 'destructive' });
      return;
    }

    const data = {
      title: pieceForm.title,
      category_id: pieceForm.category_id,
      imam_id: pieceForm.imam_id || null,
      reciter: pieceForm.reciter || null,
      language: pieceForm.language,
      text_content: pieceForm.text_content,
      audio_url: pieceForm.audio_url || null,
      video_url: pieceForm.video_url || null,
      image_url: pieceForm.image_url || null,
    };

    if (editingPiece) {
      const { error } = await safeQuery(async () =>
        await supabase
          .from('pieces')
          .update(data)
          .eq('id', editingPiece.id)
      );

      if (error) {
        toast({ title: 'Error', description: error.message || 'Failed to update piece', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Piece updated' });
    } else {
      const { error } = await safeQuery(async () =>
        await supabase.from('pieces').insert([data])
      );

      if (error) {
        toast({ title: 'Error', description: error.message || 'Failed to create piece', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Piece created' });
    }

    setPieceDialogOpen(false);
    fetchData();
  };

  // Delete function
  const handleDelete = async () => {
    if (!deleteDialog) return;

    const table = deleteDialog.type === 'category' ? 'categories' : deleteDialog.type === 'piece' ? 'pieces' : 'imams';
    const { error } = await safeQuery(async () =>
      await supabase.from(table).delete().eq('id', deleteDialog.id)
    );

    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to delete', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${deleteDialog.type} deleted` });
      fetchData();
    }

    setDeleteDialog(null);
  };

  // User Management Functions
  const openUserDialog = (userProfile?: UserProfile) => {
    if (userProfile) {
      setEditingUser(userProfile);
      setUserForm({ role: userProfile.role });
    } else {
      setEditingUser(null);
      setUserForm({ role: 'user' });
    }
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (!editingUser) {
      toast({ title: 'Error', description: 'No user selected', variant: 'destructive' });
      return;
    }

    logger.debug('Admin: Updating user role', { userId: editingUser.id, newRole: userForm.role });

    const { error } = await safeQuery(async () =>
      await (supabase as any)
        .from('profiles')
        .update({ role: userForm.role })
        .eq('id', editingUser.id)
    );

    if (error) {
      logger.error('Admin: Error updating user role:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update user role', variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'User role updated' });
    setUserDialogOpen(false);
    fetchData();
  };

  const openPermissionDialog = async (userProfile: UserProfile) => {
    if (userProfile.role !== 'uploader') {
      toast({
        title: 'Error',
        description: 'Only uploaders can have permissions assigned',
        variant: 'destructive',
      });
      return;
    }

    setSelectedUser(userProfile);
    
    // Fetch existing permissions
    const { data: perms } = await supabase
      .from('uploader_permissions')
      .select('*')
      .eq('user_id', userProfile.id);

    if (perms) {
      setUserPermissions(perms as UploaderPermission[]);
      setSelectedCategories(perms.filter(p => p.category_id).map(p => p.category_id!));
      setSelectedImams(perms.filter(p => p.imam_id).map(p => p.imam_id!));
    } else {
      setSelectedCategories([]);
      setSelectedImams([]);
    }

    setPermissionDialogOpen(true);
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    // Delete existing permissions
    await supabase
      .from('uploader_permissions')
      .delete()
      .eq('user_id', selectedUser.id);

    // Create new permissions
    const newPermissions: { user_id: string; category_id?: string; imam_id?: string }[] = [];
    
    selectedCategories.forEach(catId => {
      newPermissions.push({ user_id: selectedUser.id, category_id: catId });
    });

    selectedImams.forEach(imamId => {
      newPermissions.push({ user_id: selectedUser.id, imam_id: imamId });
    });

    if (newPermissions.length > 0) {
      const { error } = await supabase
        .from('uploader_permissions')
        .insert(newPermissions);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: 'Permissions updated' });
    setPermissionDialogOpen(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">Admin Panel</h1>

        <Tabs defaultValue="pieces" className="space-y-6">
          <TabsList className="bg-card">
            <TabsTrigger value="pieces" className="gap-2">
              <FileText className="w-4 h-4" />
              Pieces ({pieces.length})
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Categories ({categories.length})
            </TabsTrigger>
            <TabsTrigger value="imams" className="gap-2">
              <Users className="w-4 h-4" />
              Imams ({imams.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <UserCog className="w-4 h-4" />
              Users ({userProfiles.length})
            </TabsTrigger>
          </TabsList>

          {/* Pieces Tab */}
          <TabsContent value="pieces" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate('/admin/piece/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Piece
              </Button>
            </div>

            <div className="grid gap-3">
              {pieces.map((piece) => {
                const category = categories.find(c => c.id === piece.category_id);
                const imam = imams.find(f => f.id === piece.imam_id);
                return (
                  <div
                    key={piece.id}
                    className="flex items-center justify-between p-4 bg-card rounded-lg shadow-soft"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {piece.image_url && (
                        <img 
                          src={piece.image_url} 
                          alt={piece.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{piece.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {category?.name} {imam && `• ${imam.name}`} • {piece.language} {piece.reciter && `• ${piece.reciter}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/admin/piece/${piece.id}/edit`)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ type: 'piece', id: piece.id })}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {pieces.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No pieces yet. Add your first recitation!
                </div>
              )}
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openCategoryDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>

            <div className="grid gap-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 bg-card rounded-lg shadow-soft"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">/{category.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openCategoryDialog(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ type: 'category', id: category.id })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Imams Tab */}
          <TabsContent value="imams" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openImamDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Imam
              </Button>
            </div>

            <div className="grid gap-3">
              {imams.map((imam) => (
                <div
                  key={imam.id}
                  className="flex items-center justify-between p-4 bg-card rounded-lg shadow-soft"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{imam.name}</h3>
                    <p className="text-sm text-muted-foreground">{imam.description || imam.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openImamDialog(imam)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ type: 'imam', id: imam.id })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="grid gap-3">
              {userProfiles.map((userProfile) => (
                <div
                  key={userProfile.id}
                  className="flex items-center justify-between p-4 bg-card rounded-lg shadow-soft"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{userProfile.email}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        userProfile.role === 'admin' 
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : userProfile.role === 'uploader'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}>
                        {userProfile.role}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile.full_name || 'No name provided'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openUserDialog(userProfile)}
                      title="Edit role"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {userProfile.role === 'uploader' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openPermissionDialog(userProfile)}
                        title="Manage permissions"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Hidden file input */}
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        onChange={onImageSelect}
      />

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Naat"
              />
            </div>
            <div>
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="e.g., naat"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Imam Dialog */}
      <Dialog open={imamDialogOpen} onOpenChange={setImamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingImam ? 'Edit Imam' : 'Add Imam'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="imam-name">Name</Label>
              <Input
                id="imam-name"
                value={imamForm.name}
                onChange={(e) => setImamForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Imam Ali (AS)"
              />
            </div>
            <div>
              <Label htmlFor="imam-slug">Slug</Label>
              <Input
                id="imam-slug"
                value={imamForm.slug}
                onChange={(e) => setImamForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="e.g., imam-ali"
              />
            </div>
            <div>
              <Label htmlFor="imam-title">Title (optional)</Label>
              <Input
                id="imam-title"
                value={imamForm.title}
                onChange={(e) => setImamForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Commander of the Faithful"
              />
            </div>
            <div>
              <Label htmlFor="imam-desc">Description</Label>
              <Textarea
                id="imam-desc"
                value={imamForm.description}
                onChange={(e) => setImamForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImamDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveImam}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Piece Dialog */}
      <Dialog open={pieceDialogOpen} onOpenChange={setPieceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPiece ? 'Edit Piece' : 'Add New Recitation'}</DialogTitle>
            <DialogDescription>
              {editingPiece ? 'Update the recitation details below.' : 'Fill in the details to create a new recitation piece.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="piece-title">Title</Label>
              <Input
                id="piece-title"
                value={pieceForm.title}
                onChange={(e) => setPieceForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Ya Nabi Salam Alayka"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="piece-cat">Category (Type)</Label>
                <Select
                  value={pieceForm.category_id}
                  onValueChange={(v) => setPieceForm(f => ({ ...f, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border">
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="piece-imam">Dedicated To (Imam)</Label>
                <Select
                  value={pieceForm.imam_id || "none"}
                  onValueChange={(v) => setPieceForm(f => ({ ...f, imam_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select imam" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border">
                    <SelectItem value="none">None</SelectItem>
                    {imams.map(imam => (
                      <SelectItem key={imam.id} value={imam.id}>{imam.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="piece-lang">Language</Label>
                <Select
                  value={pieceForm.language}
                  onValueChange={(v) => setPieceForm(f => ({ ...f, language: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border">
                    <SelectItem value="Urdu">Urdu</SelectItem>
                    <SelectItem value="Arabic">Arabic</SelectItem>
                    <SelectItem value="Persian">Persian</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="piece-reciter">Reciter (optional)</Label>
                <Input
                  id="piece-reciter"
                  value={pieceForm.reciter}
                  onChange={(e) => setPieceForm(f => ({ ...f, reciter: e.target.value }))}
                  placeholder="e.g., Maher Zain"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <Label>Cover Image (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Upload image for image-only recitations or as cover image
              </p>
              <div className="flex items-center gap-4 mt-2">
                {pieceForm.image_url ? (
                  <div className="relative group">
                    <img 
                      src={pieceForm.image_url} 
                      alt="Preview" 
                      className="w-32 h-32 rounded-lg object-cover cursor-pointer border-2 border-border hover:border-primary transition-colors"
                      onClick={() => {
                        setImageViewerUrl(pieceForm.image_url);
                        setImageViewerOpen(true);
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageViewerUrl(pieceForm.image_url);
                          setImageViewerOpen(true);
                        }}
                      >
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-6 h-6"
                      onClick={() => setPieceForm(f => ({ ...f, image_url: '' }))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Upload Image
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="piece-text">Text Content</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBreakPoint}
                    className="gap-2"
                    title="Add paragraph/shaair break point"
                  >
                    <Scissors className="w-4 h-4" />
                    Add Break
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={translateText}
                    disabled={translating || !pieceForm.text_content.trim()}
                    className="gap-2"
                  >
                    {translating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4" />
                    )}
                    Translate
                  </Button>
                </div>
              </div>
              
              {/* Translation Language Selection */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <Label htmlFor="source-lang" className="text-xs">From</Label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger id="source-lang" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hinglish">Hinglish</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Urdu">Urdu</SelectItem>
                      <SelectItem value="Arabic">Arabic</SelectItem>
                      <SelectItem value="Persian">Persian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target-lang" className="text-xs">To</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger id="target-lang" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Urdu">Urdu</SelectItem>
                      <SelectItem value="Arabic">Arabic</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Persian">Persian</SelectItem>
                      <SelectItem value="Hinglish">Hinglish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Textarea
                id="piece-text"
                value={pieceForm.text_content}
                onChange={(e) => setPieceForm(f => ({ ...f, text_content: e.target.value }))}
                placeholder="Enter text here. Use 'Add Break' button to mark paragraph/shaair endings for better formatting."
                className="min-h-[250px] font-arabic text-right"
                dir={targetLanguage === 'Urdu' || targetLanguage === 'Arabic' ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 Tip: Click "Add Break" at the end of each paragraph/shaair for better formatting. Then translate to convert to {targetLanguage}.
              </p>
            </div>
            
            <div>
              <Label htmlFor="piece-audio">Audio URL (optional)</Label>
              <Input
                id="piece-audio"
                value={pieceForm.audio_url}
                onChange={(e) => setPieceForm(f => ({ ...f, audio_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="piece-video">Video URL (optional)</Label>
              <Input
                id="piece-video"
                value={pieceForm.video_url}
                onChange={(e) => setPieceForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="YouTube URL or direct MP4 URL"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPieceDialogOpen(false)}>Cancel</Button>
            <Button onClick={savePiece}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {deleteDialog?.type}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-7xl w-full h-[90vh] p-0">
          {imageViewerUrl && (
            <div className="relative w-full h-full flex items-center justify-center bg-black/95">
              <img 
                src={imageViewerUrl} 
                alt="Full size preview"
                className="max-w-full max-h-full object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={() => setImageViewerOpen(false)}
              >
                <XIcon className="w-6 h-6" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Role Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={editingUser?.email || ''} disabled />
            </div>
            <div>
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(v) => setUserForm({ role: v as 'admin' | 'uploader' | 'user' })}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="uploader">Uploader</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveUser}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Dialog */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions for {selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-3 block">Category Permissions</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories([...selectedCategories, category.id]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`cat-${category.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {category.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Imam Permissions</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {imams.map((imam) => (
                  <div key={imam.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`imam-${imam.id}`}
                      checked={selectedImams.includes(imam.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedImams([...selectedImams, imam.id]);
                        } else {
                          setSelectedImams(selectedImams.filter(id => id !== imam.id));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`imam-${imam.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {imam.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>Cancel</Button>
            <Button onClick={savePermissions}>Save Permissions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
