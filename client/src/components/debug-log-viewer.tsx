import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { DebugLogEntry } from '@shared/schema';
import { Terminal, Brain, Clock, Image, Copy } from 'lucide-react';

interface DebugLogViewerProps {
  debugLog: DebugLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export default function DebugLogViewer({ debugLog, isOpen, onClose }: DebugLogViewerProps) {
  const { toast } = useToast();
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds();
  };

  const copyToClipboard = async (text: string | undefined, label: string) => {
    const textToCopy = text || '';
    
    if (!textToCopy.trim()) {
      toast({
        title: "Nothing to copy",
        description: `${label} is empty`,
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const primaryLogs = debugLog.filter(log => log.type === 'primary');
  const parserLogs = debugLog.filter(log => log.type === 'parser');
  const imageLogs = debugLog.filter(log => log.type === 'image');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Terminal className="w-5 h-5" />
            LLM Debug Log
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({debugLog.length})</TabsTrigger>
            <TabsTrigger value="primary">Primary DM ({primaryLogs.length})</TabsTrigger>
            <TabsTrigger value="parser">Parser ({parserLogs.length})</TabsTrigger>
            <TabsTrigger value="image">Image Gen ({imageLogs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex-1 min-h-0">
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {debugLog.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No debug logs yet. Take an action to see LLM interactions.
                  </div>
                ) : (
                  debugLog.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.type === 'primary' ? (
                            <Brain className="w-4 h-4 text-primary" />
                          ) : log.type === 'parser' ? (
                            <Terminal className="w-4 h-4 text-accent" />
                          ) : (
                            <Image className="w-4 h-4 text-blue-500" />
                          )}
                          <span className="font-semibold text-sm">
                            {log.type === 'primary' ? 'Primary DM' : log.type === 'parser' ? 'Parser' : 'Image Generation'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{log.model}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>

                      {log.tokens && (
                        <div className="text-xs text-muted-foreground">
                          Tokens: {log.tokens.prompt} prompt + {log.tokens.completion} completion = {log.tokens.prompt + log.tokens.completion} total
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Prompt:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.prompt, 'Prompt')}
                            data-testid={`copy-prompt-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.prompt}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Response:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.response, 'Response')}
                            data-testid={`copy-response-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.response}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="primary" className="flex-1 min-h-0">
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {primaryLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No primary DM logs yet.
                  </div>
                ) : (
                  primaryLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 space-y-3 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-primary" />
                          <span className="text-xs text-muted-foreground font-mono">{log.model}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>

                      {log.tokens && (
                        <div className="text-xs text-muted-foreground">
                          Tokens: {log.tokens.prompt} prompt + {log.tokens.completion} completion = {log.tokens.prompt + log.tokens.completion} total
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Prompt:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.prompt, 'Prompt')}
                            data-testid={`copy-prompt-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.prompt}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Response:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.response, 'Response')}
                            data-testid={`copy-response-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.response}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="parser" className="flex-1 min-h-0">
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {parserLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No parser logs yet.
                  </div>
                ) : (
                  parserLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 space-y-3 bg-accent/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-accent" />
                          <span className="text-xs text-muted-foreground font-mono">{log.model}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>

                      {log.tokens && (
                        <div className="text-xs text-muted-foreground">
                          Tokens: {log.tokens.prompt} prompt + {log.tokens.completion} completion = {log.tokens.prompt + log.tokens.completion} total
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Prompt:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.prompt, 'Prompt')}
                            data-testid={`copy-prompt-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.prompt}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Response:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.response, 'Response')}
                            data-testid={`copy-response-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.response}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="image" className="flex-1 min-h-0">
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {imageLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No image generation logs yet.
                  </div>
                ) : (
                  imageLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 space-y-3 bg-blue-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Image className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground font-mono">{log.model}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>

                      {log.tokens && (
                        <div className="text-xs text-muted-foreground">
                          Tokens: {log.tokens.prompt} prompt + {log.tokens.completion} completion = {log.tokens.prompt + log.tokens.completion} total
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground space-y-1">
                        {log.entityType && <div>Entity Type: <span className="font-semibold">{log.entityType}</span></div>}
                        {log.imageUrl !== undefined && (
                          <div>Result: <span className={`font-semibold ${log.imageUrl ? 'text-green-600' : 'text-red-600'}`}>
                            {log.imageUrl ? '✓ Image Generated' : '✗ Failed'}
                          </span></div>
                        )}
                        {log.error && <div className="text-red-500">Error: {log.error}</div>}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">Prompt:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.prompt, 'Prompt')}
                            data-testid={`copy-prompt-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.prompt}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-foreground">API Response:</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(log.response, 'Response')}
                            data-testid={`copy-response-${log.id}`}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border rounded p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {log.response}
                        </pre>
                      </div>

                      {log.imageUrl && (
                        <div>
                          <div className="text-xs font-semibold text-foreground mb-1">Generated Image:</div>
                          <img src={log.imageUrl} alt="Generated" className="max-w-xs rounded border" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
