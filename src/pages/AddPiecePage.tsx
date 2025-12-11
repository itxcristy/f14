import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Upload, Languages, Scissors, Maximize2, X as XIcon, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/use-user-role';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import type { Category, Piece, Imam } from '@/lib/supabase-types';

export default function AddPiecePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { role, loading: roleLoading } = useUserRole();
  const isEditing = !!id;
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [imams, setImams] = useState<Imam[]>([]);
  const [permissions, setPermissions] = useState<{ categoryIds: string[]; imamIds: string[] }>({ categoryIds: [], imamIds: [] });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('Hinglish');
  const [targetLanguage, setTargetLanguage] = useState('Urdu');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
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

  useEffect(() => {
    checkAuth();
  }, [role, roleLoading]);

  useEffect(() => {
    if (role === 'admin' || role === 'uploader') {
      fetchData();
    }
  }, [role, id]);

  const checkAuth = async () => {
    if (roleLoading) return;
    
    if (role !== 'uploader' && role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'You need uploader or admin permissions to access this page.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch user permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let categoryIds: string[] = [];
    let imamIds: string[] = [];

    if (role === 'uploader') {
      const { data: perms } = await supabase
        .from('uploader_permissions')
        .select('category_id, imam_id')
        .eq('user_id', user.id);

      categoryIds = perms?.filter(p => p.category_id).map(p => p.category_id!) || [];
      imamIds = perms?.filter(p => p.imam_id).map(p => p.imam_id!) || [];

      setPermissions({ categoryIds, imamIds });
    }

    // Fetch categories and imams
    const [catRes, imamRes] = await Promise.all([
      role === 'admin' 
        ? supabase.from('categories').select('*').order('name')
        : supabase.from('categories').select('*').in('id', categoryIds.length > 0 ? categoryIds : ['00000000-0000-0000-0000-000000000000']).order('name'),
      role === 'admin'
        ? supabase.from('imams').select('*').order('order_index, name')
        : supabase.from('imams').select('*').in('id', imamIds.length > 0 ? imamIds : ['00000000-0000-0000-0000-000000000000']).order('order_index, name'),
    ]);

    if (catRes.data) {
      setCategories(catRes.data as Category[]);
      // Set default category if creating new piece
      if (!isEditing && catRes.data.length > 0 && !pieceForm.category_id) {
        setPieceForm(f => ({ ...f, category_id: catRes.data[0].id }));
      }
    }
    if (imamRes.data) {
      setImams(imamRes.data as Imam[]);
    }

    // If editing, fetch the piece data
    if (isEditing && id) {
      const { data: pieceData, error } = await supabase
        .from('pieces')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to load piece data',
          variant: 'destructive',
        });
        navigate(role === 'admin' ? '/admin' : '/uploader');
        return;
      }

      const piece = pieceData as Piece;
      
      // Check permissions for uploaders
      if (role === 'uploader' && user) {
        // Re-fetch permissions if needed
        const { data: perms } = await supabase
          .from('uploader_permissions')
          .select('category_id, imam_id')
          .eq('user_id', user.id);

        const categoryIds = perms?.filter(p => p.category_id).map(p => p.category_id!) || [];
        const imamIds = perms?.filter(p => p.imam_id).map(p => p.imam_id!) || [];

        const hasCategoryPerm = categoryIds.includes(piece.category_id);
        const hasImamPerm = !piece.imam_id || imamIds.includes(piece.imam_id);
        
        if (!hasCategoryPerm || !hasImamPerm) {
          toast({
            title: 'Permission Denied',
            description: 'You do not have permission to edit this piece.',
            variant: 'destructive',
          });
          navigate('/uploader');
          return;
        }
      }

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
      }

    setLoading(false);
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
      
      // Upload with upsert option and proper content type
      const { data, error } = await supabase.storage
        .from('piece-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });
      
      if (error) {
        logger.error('Image upload error:', error);
        
        // Provide more specific error messages
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

  const savePiece = async () => {
    if (!pieceForm.title || !pieceForm.category_id || !pieceForm.text_content) {
      toast({ title: 'Error', description: 'Title, category, and text are required', variant: 'destructive' });
      return;
    }

    // Check permissions for uploaders
    if (role === 'uploader') {
      if (!permissions.categoryIds.includes(pieceForm.category_id)) {
        toast({
          title: 'Permission Denied',
          description: 'You do not have permission to upload to this category.',
          variant: 'destructive',
        });
        return;
      }

      if (pieceForm.imam_id && !permissions.imamIds.includes(pieceForm.imam_id)) {
        toast({
          title: 'Permission Denied',
          description: 'You do not have permission to upload for this imam.',
          variant: 'destructive',
        });
        return;
      }
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

    if (isEditing && id) {
      const { error } = await safeQuery(async () =>
        await supabase
          .from('pieces')
          .update(data)
          .eq('id', id)
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

    // Navigate back to admin/uploader page
    navigate(role === 'admin' ? '/admin' : '/uploader');
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (role !== 'uploader' && role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 max-w-4xl">
        <Link 
          to={role === 'admin' ? '/admin' : '/uploader'}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {role === 'admin' ? 'Admin' : 'Uploader'} Dashboard
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">
          {isEditing ? 'Edit Piece' : 'Add New Recitation'}
        </h1>

        <div className="space-y-6 bg-card p-6 rounded-lg shadow-soft">
          <div>
            <Label htmlFor="piece-title">Title</Label>
            <Input
              id="piece-title"
              value={pieceForm.title}
              onChange={(e) => setPieceForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g., Ya Nabi Salam Alayka"
              className="mt-2"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="piece-cat">Category (Type)</Label>
              <Select
                value={pieceForm.category_id}
                onValueChange={(v) => setPieceForm(f => ({ ...f, category_id: v }))}
              >
                <SelectTrigger className="mt-2">
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
                <SelectTrigger className="mt-2">
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
                <SelectTrigger className="mt-2">
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
                className="mt-2"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <Label>Cover Image (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2 mt-1">
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
                    <XIcon className="w-3 h-3" />
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
              className={`min-h-[300px] font-arabic ${targetLanguage === 'Urdu' || targetLanguage === 'Arabic' ? 'text-right' : 'text-left'}`}
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
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="piece-video">Video URL (optional)</Label>
            <Input
              id="piece-video"
              value={pieceForm.video_url}
              onChange={(e) => setPieceForm(f => ({ ...f, video_url: e.target.value }))}
              placeholder="YouTube URL or direct MP4 URL"
              className="mt-2"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(role === 'admin' ? '/admin' : '/uploader')}
            >
              Cancel
            </Button>
            <Button onClick={savePiece}>
              {isEditing ? 'Update' : 'Create'} Piece
            </Button>
          </div>
        </div>
      </main>

      {/* Hidden file input */}
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        onChange={onImageSelect}
      />

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
    </div>
  );
}

