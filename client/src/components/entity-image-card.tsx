import { AspectRatio } from '@/components/ui/aspect-ratio';
import { User, MapPin, RefreshCw } from 'lucide-react';

interface EntityImageCardProps {
  imageUrl?: string;
  entityType: 'character' | 'companion' | 'npc' | 'location';
  onClick?: () => void;
  isGenerating?: boolean;
  className?: string;
}

export function EntityImageCard({ 
  imageUrl, 
  entityType, 
  onClick, 
  isGenerating = false,
  className = '' 
}: EntityImageCardProps) {
  const Icon = entityType === 'location' ? MapPin : User;
  
  return (
    <div 
      className={`relative cursor-pointer group ${className}`}
      onClick={onClick}
      data-testid={`image-card-${entityType}`}
    >
      <AspectRatio ratio={1/1}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`${entityType} portrait`}
            className="rounded-md object-cover w-full h-full border-2 border-border group-hover:border-primary transition-colors"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-muted/30 border-2 border-border rounded-md group-hover:border-primary transition-colors">
            {isGenerating ? (
              <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
            ) : (
              <Icon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        )}
      </AspectRatio>
    </div>
  );
}
