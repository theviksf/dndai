import { useState, useRef, useEffect } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface InlineEditProps {
  value: string | number;
  onSave: (value: string | number) => void;
  type?: 'text' | 'number' | 'textarea';
  className?: string;
  inputClassName?: string;
  min?: number;
  max?: number;
  displayAs?: (value: string | number) => string;
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  className = '',
  inputClassName = '',
  min,
  max,
  displayAs,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync editValue with value prop changes
  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleSave = () => {
    const finalValue = type === 'number' ? Number(editValue) : editValue;
    
    if (type === 'number') {
      const numVal = Number(editValue);
      if (isNaN(numVal)) return;
      if (min !== undefined && numVal < min) return;
      if (max !== undefined && numVal > max) return;
    }
    
    onSave(finalValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {type === 'textarea' ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`min-h-[60px] ${inputClassName}`}
            data-testid="inline-edit-textarea"
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            className={inputClassName}
            data-testid="inline-edit-input"
          />
        )}
        <button
          onClick={handleSave}
          className="p-1 hover:bg-accent rounded text-green-600"
          data-testid="button-save-inline"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 hover:bg-accent rounded text-red-600"
          data-testid="button-cancel-inline"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-accent/10 rounded px-1 py-0.5 inline-flex items-center gap-1 group ${className}`}
      data-testid="inline-edit-display"
    >
      <span>{displayAs ? displayAs(value) : value}</span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}
