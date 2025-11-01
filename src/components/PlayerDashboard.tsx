import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, LogOut, Loader2, Trophy, AlertCircle, Home, Eye, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Standings from "./Standings";
import { Team, Tournament, PLACEMENT_POINTS, KILL_POINTS } from "@/types/tournament";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PlayerDashboardProps {
  userId: string;
}

const PlayerDashboard = ({ userId }: PlayerDashboardProps) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadedScreenshots, setUploadedScreenshots] = useState<number>(0);
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0 });
  const [screenshots, setScreenshots] = useState<Array<{ id: string; screenshot_url: string; match_number: number | null; placement: number | null; kills: number | null; created_at: string }>>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchUserTeam();
    fetchScreenshots();
  }, [userId]);

  useEffect(() => {
    if (userTeam?.tournament_id) {
      fetchTeams();
      fetchTournament();
    }
  }, [userTeam?.tournament_id]);

  useEffect(() => {
    // Set up real-time subscription for team updates
    const channel = supabase
      .channel('team-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
        },
        () => {
          fetchUserTeam();
          if (userTeam?.tournament_id) {
            fetchTeams();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userTeam?.tournament_id]);

  const fetchUserTeam = async () => {
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("team_id")
      .eq("user_id", userId)
      .single();

    if (sessionError || !sessionData?.team_id) {
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", sessionData.team_id)
      .single();

    if (teamError) {
      return;
    }

    const mappedTeam: Team = {
      id: teamData.id,
      name: teamData.name,
      totalPoints: teamData.total_points || 0,
      placementPoints: teamData.placement_points || 0,
      killPoints: teamData.kill_points || 0,
      totalKills: teamData.total_kills || 0,
      matchesPlayed: teamData.matches_played || 0,
      firstPlaceWins: teamData.first_place_wins || 0,
      tournament_id: teamData.tournament_id,
      logo_url: teamData.logo_url,
    };

    setUserTeam(mappedTeam);

    const { data: screenshotsData } = await supabase
      .from("match_screenshots")
      .select("id")
      .eq("team_id", sessionData.team_id);

    setUploadedScreenshots(screenshotsData?.length || 0);
    fetchScreenshots();
  };

  const fetchScreenshots = async () => {
    if (!userId) return;

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("team_id")
      .eq("user_id", userId)
      .single();

    if (!sessionData?.team_id) return;

    const { data, error } = await supabase
      .from("match_screenshots")
      .select("id, screenshot_url, match_number, placement, kills, created_at")
      .eq("team_id", sessionData.team_id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setScreenshots(data);
    }
  };

  const fetchTournament = async () => {
    if (!userTeam?.tournament_id) return;

    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", userTeam.tournament_id)
      .single();

    if (!error && data) {
      setTournament(data);
    }
  };

  const fetchTeams = async () => {
    if (!userTeam?.tournament_id) return;

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", userTeam.tournament_id);

    if (error) {
      return;
    }

    const mappedTeams: Team[] = (data || []).map((team) => ({
      id: team.id,
      name: team.name,
      totalPoints: team.total_points || 0,
      placementPoints: team.placement_points || 0,
      killPoints: team.kill_points || 0,
      totalKills: team.total_kills || 0,
      matchesPlayed: team.matches_played || 0,
      firstPlaceWins: team.first_place_wins || 0,
      tournament_id: team.tournament_id,
      logo_url: team.logo_url,
    }));

    setTeams(mappedTeams);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !userTeam) return;

    // Check total screenshot limit
    const remainingSlots = 12 - uploadedScreenshots;
    if (remainingSlots <= 0) {
      toast.error("You have already uploaded the maximum of 12 screenshots");
      return;
    }

    // Limit files to remaining slots and max 4 at a time
    const maxFiles = Math.min(files.length, remainingSlots, 4);
    const filesToUpload = Array.from(files).slice(0, maxFiles);
    
    if (files.length > maxFiles) {
      toast.error(`You can only upload ${maxFiles} more screenshot(s)`);
    }

    // Validate all files
    const fileSchema = z.custom<File>((val) => val instanceof File)
      .refine((file) => file.size <= 5 * 1024 * 1024, 'File must be less than 5MB')
      .refine((file) => ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type), 'Only JPG/PNG images allowed');

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
      const fileName = `${userTeam.id}/${Date.now()}-${i}.${fileExt}`;

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
          team_id: userTeam.id,
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
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke("analyze-screenshot", {
          body: {
            screenshot_url: urlData.publicUrl,
            screenshot_id: insertData.id,
            team_id: userTeam.id
          }
        });

        if (analysisError) {
          console.error(`AI analysis error for screenshot ${i + 1}:`, analysisError);
          const errorMsg = analysisData?.error || analysisError.message || "Unknown error";
          console.error(`Error details: ${errorMsg}`);
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
        toast.error(`Screenshot ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        uploadResults.push({ success: false, index: i });
      }

      // Small delay between analyses to avoid hitting rate limits
      await new Promise((res) => setTimeout(res, 250));
    }

    // Show summary
    const successCount = uploadResults.filter(r => r.success).length;
    const failCount = uploadResults.filter(r => !r.success).length;
    
    if (successCount > 0) {
      toast.success(`Successfully analyzed ${successCount} screenshot(s)`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} screenshot(s) failed analysis - admin will verify manually`);
    }

    fetchUserTeam();
    fetchScreenshots();

    setUploading(false);
    setUploadProgress("");
    setUploadStats({ current: 0, total: 0 });
    event.target.value = "";
  };

  const handleDeleteScreenshot = async (screenshotId: string, screenshotUrl: string) => {
    if (!confirm("Are you sure you want to delete this screenshot? This action cannot be undone.")) {
      return;
    }

    setDeleting(screenshotId);

    try {
      // Get screenshot data before deleting to update team stats
      const { data: screenshotData, error: fetchError } = await supabase
        .from("match_screenshots")
        .select("points, kills, placement, team_id")
        .eq("id", screenshotId)
        .single();

      if (fetchError) {
        toast.error("Failed to fetch screenshot data");
        return;
      }

      // Extract file path from URL
      const url = new URL(screenshotUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(pathParts.indexOf('screenshots') + 1).join('/');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("screenshots")
        .remove([filePath]);

      if (storageError) {
        toast.error("Failed to delete screenshot file");
        return;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("match_screenshots")
        .delete()
        .eq("id", screenshotId);

      if (dbError) {
        toast.error("Failed to delete screenshot record");
        return;
      }

      // Update team stats if screenshot had valid data
      if (screenshotData.points !== null && screenshotData.kills !== null && screenshotData.placement !== null) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("total_points, kill_points, placement_points, total_kills, matches_played, first_place_wins")
          .eq("id", screenshotData.team_id)
          .single();

        if (teamData) {
          const placementPoints = PLACEMENT_POINTS[screenshotData.placement] || 0;
          const killPoints = screenshotData.kills * KILL_POINTS;
          
          await supabase
            .from("teams")
            .update({
              total_points: Math.max(0, teamData.total_points - screenshotData.points),
              placement_points: Math.max(0, teamData.placement_points - placementPoints),
              kill_points: Math.max(0, teamData.kill_points - killPoints),
              total_kills: Math.max(0, teamData.total_kills - screenshotData.kills),
              matches_played: Math.max(0, teamData.matches_played - 1),
              first_place_wins: screenshotData.placement === 1 ? Math.max(0, teamData.first_place_wins - 1) : teamData.first_place_wins,
            })
            .eq("id", screenshotData.team_id);
        }
      }

      toast.success("Screenshot deleted successfully");
      fetchUserTeam();
      fetchScreenshots();
    } catch (error) {
      console.error("Error deleting screenshot:", error);
      toast.error("An error occurred while deleting the screenshot");
    } finally {
      setDeleting(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!userTeam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background tactical-grid">
        <Card className="card-tactical p-8 max-w-md mx-4 border-2 border-primary/20">
          <div className="text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-accent mx-auto" />
            <h2 className="text-2xl font-rajdhani font-bold uppercase">No Team Assigned</h2>
            <p className="text-muted-foreground font-barlow">
              You haven't been assigned to a team yet. Please contact the tournament admin to assign you to a team.
            </p>
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="outline" onClick={() => navigate("/")} className="btn-glow">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background tactical-grid">
      <header className="border-b-2 border-primary/30 bg-gradient-tactical backdrop-blur-sm sticky top-0 z-50 shadow-glow-orange">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-rajdhani font-black text-foreground uppercase tracking-wider">
              <span className="bg-gradient-primary bg-clip-text text-transparent">{userTeam.name}</span>
            </h1>
            {tournament && (
              <p className="text-sm text-muted-foreground font-barlow">{tournament.name}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")} className="btn-glow">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card-tactical p-6 border-2 border-primary/20 hover-lift">
            <h2 className="text-xl font-rajdhani font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Team Stats
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-barlow">Total Points</span>
                <span className="stat-counter text-2xl">{userTeam.totalPoints}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/30 pt-3">
                <span className="text-muted-foreground font-barlow">Placement Points</span>
                <span className="font-rajdhani font-bold text-lg text-foreground">{userTeam.placementPoints}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/30 pt-3">
                <span className="text-muted-foreground font-barlow">Kill Points</span>
                <span className="font-rajdhani font-bold text-lg text-foreground">{userTeam.killPoints}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/30 pt-3">
                <span className="text-muted-foreground font-barlow">Total Kills</span>
                <span className="kill-feed text-lg">{userTeam.totalKills}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/30 pt-3">
                <span className="text-muted-foreground font-barlow">Matches Played</span>
                <span className="font-rajdhani font-bold text-lg text-foreground">{userTeam.matchesPlayed}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/30 pt-3">
                <span className="text-muted-foreground font-barlow">Chicken Dinners</span>
                <span className="font-rajdhani font-bold text-lg text-accent">{userTeam.firstPlaceWins}</span>
              </div>
            </div>
          </div>

          <div className="card-tactical p-6 border-2 border-primary/20">
            <h2 className="text-xl font-rajdhani font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-accent" />
              Upload Screenshots
            </h2>
            {uploadedScreenshots >= 12 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have uploaded the maximum of 12 screenshots.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="screenshot">Screenshots (up to 4 at once)</Label>
                  <Input
                    id="screenshot"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadProgress}
                    </div>
                    {uploadStats.total > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Processing {uploadStats.current} of {uploadStats.total}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Upload up to 4 screenshots at once. Each will be automatically analyzed by AI. ({uploadedScreenshots}/12 uploaded)
                </p>
              </div>
            )}
          </div>
        </div>

        {screenshots.length > 0 && (
          <div className="card-tactical p-6 border-2 border-primary/20">
            <h2 className="text-xl font-rajdhani font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-accent" />
              Uploaded Screenshots ({screenshots.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {screenshots.map((screenshot) => (
                <div key={screenshot.id} className="relative group border border-border/30 rounded-lg overflow-hidden hover-lift">
                  <div className="aspect-video relative bg-muted">
                    <img
                      src={screenshot.screenshot_url}
                      alt="Match screenshot"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedScreenshot(screenshot.screenshot_url)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteScreenshot(screenshot.id, screenshot.screenshot_url)}
                        disabled={deleting === screenshot.id}
                      >
                        {deleting === screenshot.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="p-2 bg-card space-y-1">
                    <div className="text-xs text-muted-foreground font-barlow">
                      {screenshot.match_number ? `Match #${screenshot.match_number}` : 'Pending Analysis'}
                    </div>
                    {screenshot.placement && screenshot.kills !== null && (
                      <div className="text-xs font-rajdhani">
                        <span className="text-foreground">Placement: #{screenshot.placement}</span>
                        <span className="mx-2">•</span>
                        <span className="text-accent">Kills: {screenshot.kills}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Standings teams={teams} />
        </div>
      </main>

      <Dialog open={!!selectedScreenshot} onOpenChange={() => setSelectedScreenshot(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot Preview</DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <img
              src={selectedScreenshot}
              alt="Screenshot preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlayerDashboard;
