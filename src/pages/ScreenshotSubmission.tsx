import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload,
  Home,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Eye,
  Trophy,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  tournament_id: string | null;
}

interface Screenshot {
  id: string;
  team_id: string;
  team_name: string;
  screenshot_url: string;
  match_number: number | null;
  placement: number | null;
  kills: number | null;
  created_at: string;
}

const ScreenshotSubmission = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [teamScreenshotCounts, setTeamScreenshotCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchTeams();
    fetchAllScreenshots();
  }, []);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, logo_url, tournament_id")
      .order("name");

    if (!error && data) {
      setTeams(data);
    }
    setLoading(false);
  };

  const fetchAllScreenshots = async () => {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name");

    if (!teamsData) return;

    const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));

    const { data, error } = await supabase
      .from("match_screenshots")
      .select("id, team_id, screenshot_url, match_number, placement, kills, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const screenshotsWithTeamNames = data.map((s) => ({
        ...s,
        team_name: teamMap.get(s.team_id) || "Unknown Team",
      }));
      setScreenshots(screenshotsWithTeamNames);

      // Calculate counts per team
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        counts[s.team_id] = (counts[s.team_id] || 0) + 1;
      });
      setTeamScreenshotCounts(counts);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedTeamId) {
      if (!selectedTeamId) {
        toast.error("Please select a team first");
      }
      return;
    }

    const selectedTeam = teams.find((t) => t.id === selectedTeamId);
    if (!selectedTeam) return;

    // Check total screenshot limit
    const currentCount = teamScreenshotCounts[selectedTeamId] || 0;
    const remainingSlots = 12 - currentCount;
    if (remainingSlots <= 0) {
      toast.error("This team has already uploaded the maximum of 12 screenshots");
      return;
    }

    // Limit files to remaining slots and max 4 at a time
    const maxFiles = Math.min(files.length, remainingSlots, 4);
    const filesToUpload = Array.from(files).slice(0, maxFiles);

    if (files.length > maxFiles) {
      toast.error(`You can only upload ${maxFiles} more screenshot(s)`);
    }

    // Validate all files
    const fileSchema = z
      .custom<File>((val) => val instanceof File)
      .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
      .refine(
        (file) => ["image/jpeg", "image/png", "image/jpg"].includes(file.type),
        "Only JPG/PNG images allowed"
      );

    for (const file of filesToUpload) {
      try {
        fileSchema.parse(file);
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast.error(`${file.name}: ${error.errors[0].message}`);
          return;
        }
      }
    }

    setUploading(true);
    setUploadStats({ current: 0, total: filesToUpload.length });

    const uploadResults: Array<{ success: boolean; index: number }> = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];

      setUploadStats({ current: i + 1, total: filesToUpload.length });
      setUploadProgress(`Uploading screenshot ${i + 1} of ${filesToUpload.length}...`);

      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedTeamId}/${Date.now()}-${i}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(fileName, file);

      if (uploadError) {
        toast.error(`Failed to upload screenshot ${i + 1}`);
        uploadResults.push({ success: false, index: i });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("screenshots")
        .getPublicUrl(fileName);

      setUploadProgress(`Saving screenshot ${i + 1} data...`);

      const { error: insertError, data: insertData } = await supabase
        .from("match_screenshots")
        .insert({
          team_id: selectedTeamId,
          screenshot_url: urlData.publicUrl,
        })
        .select("id")
        .single();

      if (insertError || !insertData) {
        toast.error(`Failed to save screenshot ${i + 1}`);
        uploadResults.push({ success: false, index: i });
        continue;
      }

      setUploadProgress(`Analyzing screenshot ${i + 1} with AI...`);

      // Call AI analysis function
      try {
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          "analyze-screenshot",
          {
            body: {
              screenshot_url: urlData.publicUrl,
              screenshot_id: insertData.id,
              team_id: selectedTeamId,
            },
          }
        );

        if (analysisError) {
          console.error(`AI analysis error for screenshot ${i + 1}:`, analysisError);
          const errorMsg = analysisData?.error || analysisError.message || "Unknown error";
          toast.error(`Screenshot ${i + 1} analysis failed: ${errorMsg}`);
          uploadResults.push({ success: false, index: i });
        } else if (analysisData?.error) {
          console.error(`AI analysis returned error for screenshot ${i + 1}:`, analysisData.error);
          toast.error(`Screenshot ${i + 1} analysis failed: ${analysisData.error}`);
          uploadResults.push({ success: false, index: i });
        } else {
          console.log(`AI analysis success for screenshot ${i + 1}:`, analysisData);
          uploadResults.push({ success: true, index: i });
        }
      } catch (error) {
        console.error(`Exception during AI analysis for screenshot ${i + 1}:`, error);
        toast.error(
          `Screenshot ${i + 1} failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        uploadResults.push({ success: false, index: i });
      }

      // Small delay between analyses to avoid hitting rate limits
      await new Promise((res) => setTimeout(res, 250));
    }

    // Show summary
    const successCount = uploadResults.filter((r) => r.success).length;
    const failCount = uploadResults.filter((r) => !r.success).length;

    if (successCount > 0) {
      toast.success(`Successfully analyzed ${successCount} screenshot(s)`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} screenshot(s) failed analysis - admin will verify manually`);
    }

    fetchAllScreenshots();

    setUploading(false);
    setUploadProgress("");
    setUploadStats({ current: 0, total: 0 });
    event.target.value = "";
  };

  // Group screenshots by team
  const screenshotsByTeam = screenshots.reduce((acc, screenshot) => {
    const teamId = screenshot.team_id;
    if (!acc[teamId]) {
      acc[teamId] = {
        team_name: screenshot.team_name,
        screenshots: [],
      };
    }
    acc[teamId].screenshots.push(screenshot);
    return acc;
  }, {} as Record<string, { team_name: string; screenshots: Screenshot[] }>);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const currentCount = teamScreenshotCounts[selectedTeamId] || 0;
  const canUpload = selectedTeamId && currentCount < 12;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 tactical-grid opacity-10 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b-2 border-primary/20 bg-card/80 backdrop-blur-md shadow-glow-orange">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-lg opacity-50"></div>
                <div className="relative p-2 bg-gradient-primary rounded-lg">
                  <Upload className="h-6 w-6 text-background" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-rajdhani font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Screenshot Submission
                </h1>
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Upload Match Results
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="btn-glow"
            >
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Upload Section */}
        <Card className="card-tactical p-4 sm:p-6 border-2 border-primary/20">
          <h2 className="text-lg sm:text-xl font-rajdhani font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-accent" />
            Upload Screenshots
          </h2>

          <div className="space-y-4">
            {/* Team Selection */}
            <div className="space-y-2">
              <Label className="font-rajdhani uppercase tracking-wide text-sm">
                Select Your Team
              </Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-full bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Choose a team..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        {team.logo_url ? (
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="h-5 w-5 rounded object-cover"
                          />
                        ) : (
                          <Users className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span>{team.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({teamScreenshotCounts[team.id] || 0}/12)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload Area */}
            {selectedTeamId && currentCount >= 12 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This team has uploaded the maximum of 12 screenshots.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="screenshot-upload" className="font-barlow text-sm">
                    Upload match screenshots (max 4 at a time, {selectedTeamId ? `${12 - currentCount} remaining` : "select team first"})
                  </Label>
                  <Input
                    id="screenshot-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading || !selectedTeamId}
                    className="mt-2 cursor-pointer bg-secondary/30 border-dashed border-2 border-border/50 hover:border-primary/50 transition-colors file:bg-primary file:text-primary-foreground file:border-0 file:rounded file:px-3 file:py-1 file:mr-3 file:font-rajdhani file:uppercase"
                  />
                </div>

                {uploading && (
                  <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border border-border/30">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-barlow">{uploadProgress}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-primary h-full transition-all duration-300"
                        style={{
                          width: `${(uploadStats.current / uploadStats.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Processing {uploadStats.current} of {uploadStats.total} screenshots
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground font-barlow">
                  AI will automatically extract placement and kills from screenshots. Max file size: 5MB per image.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* All Screenshots Section */}
        <Card className="card-tactical p-4 sm:p-6 border-2 border-primary/20">
          <h2 className="text-lg sm:text-xl font-rajdhani font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            All Team Screenshots
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : Object.keys(screenshotsByTeam).length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground font-barlow">No screenshots uploaded yet</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(screenshotsByTeam).map(([teamId, { team_name, screenshots: teamScreenshots }]) => (
                <AccordionItem
                  key={teamId}
                  value={teamId}
                  className="border border-border/30 rounded-lg bg-secondary/20 px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="font-rajdhani font-bold uppercase">{team_name}</span>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {teamScreenshots.length} screenshot(s)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {teamScreenshots.map((screenshot) => (
                        <div
                          key={screenshot.id}
                          className="p-3 bg-card/50 rounded-lg border border-border/20 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-rajdhani font-semibold">
                              Match #{screenshot.match_number || "?"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedImage(screenshot.screenshot_url)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Placement: </span>
                              <span className="font-bold text-primary">
                                #{screenshot.placement || "?"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Kills: </span>
                              <span className="font-bold text-accent">
                                {screenshot.kills ?? "?"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(screenshot.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>
      </main>

      {/* Image View Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-rajdhani uppercase">Screenshot Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Screenshot"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Footer Accent */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-30 pointer-events-none"></div>
    </div>
  );
};

export default ScreenshotSubmission;
