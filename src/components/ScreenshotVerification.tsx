import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Edit, Loader2, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { calculatePoints } from "@/types/tournament";

interface Team {
  id: string;
  name: string;
}

interface MatchScreenshot {
  id: string;
  team_id: string;
  team_name: string;
  match_number: number;
  placement: number | null;
  kills: number | null;
  points: number | null;
  screenshot_url: string;
  created_at: string;
}

interface ScreenshotVerificationProps {
  selectedTournament: string | null;
}

const ScreenshotVerification = ({ selectedTournament }: ScreenshotVerificationProps) => {
  const [screenshots, setScreenshots] = useState<MatchScreenshot[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewImageDialogOpen, setViewImageDialogOpen] = useState(false);
  const [manualEntryDialogOpen, setManualEntryDialogOpen] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<MatchScreenshot | null>(null);
  const [editPlacement, setEditPlacement] = useState<number>(1);
  const [editKills, setEditKills] = useState<number>(0);
  const [manualTeamId, setManualTeamId] = useState<string>("");
  const [manualMatchNumber, setManualMatchNumber] = useState<number>(1);
  const [manualPlacement, setManualPlacement] = useState<number>(1);
  const [manualKills, setManualKills] = useState<number>(0);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [screenshotToDelete, setScreenshotToDelete] = useState<MatchScreenshot | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (selectedTournament) {
      fetchScreenshots();
      
      const interval = setInterval(fetchScreenshots, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTournament]);

  const fetchScreenshots = async () => {
    if (!selectedTournament) return;

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("tournament_id", selectedTournament);

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return;
    }

    setTeams(teamsData || []);
    const teamMap = new Map(teamsData.map((team) => [team.id, team.name]));

    const { data, error } = await supabase
      .from("match_screenshots")
      .select("*")
      .in("team_id", Array.from(teamMap.keys()))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching screenshots:", error);
      return;
    }

    const screenshotsWithTeamNames = (data || []).map((screenshot) => ({
      ...screenshot,
      team_name: teamMap.get(screenshot.team_id) || "Unknown Team",
    }));

    setScreenshots(screenshotsWithTeamNames);
    setLoading(false);
  };

  const handleEditClick = (screenshot: MatchScreenshot) => {
    setSelectedScreenshot(screenshot);
    setEditPlacement(screenshot.placement || 1);
    setEditKills(screenshot.kills || 0);
    setEditDialogOpen(true);
  };

  const handleViewImage = (screenshot: MatchScreenshot) => {
    setSelectedScreenshot(screenshot);
    setViewImageDialogOpen(true);
  };

  const handleUpdateScreenshot = async () => {
    if (!selectedScreenshot) return;

    // Validate inputs
    const matchDataSchema = z.object({
      placement: z.number().int().min(1).max(18),
      kills: z.number().int().min(0).max(50)
    });

    try {
      matchDataSchema.parse({ placement: editPlacement, kills: editKills });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setUpdating(true);

    const points = calculatePoints(editPlacement, editKills);

    const { error: screenshotError } = await supabase
      .from("match_screenshots")
      .update({
        placement: editPlacement,
        kills: editKills,
        points: points,
      })
      .eq("id", selectedScreenshot.id);

    if (screenshotError) {
      toast.error("Failed to update screenshot");
      setUpdating(false);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("match_screenshots")
      .select("*")
      .eq("team_id", selectedScreenshot.team_id);

    if (teamError) {
      toast.error("Failed to recalculate team stats");
      setUpdating(false);
      return;
    }

    const totalPoints = teamData.reduce((sum, s) => sum + (s.points || 0), 0);
    const placementPoints = teamData.reduce((sum, s) => {
      const placement = s.placement || 0;
      const points = calculatePoints(placement, 0);
      return sum + points;
    }, 0);
    const totalKills = teamData.reduce((sum, s) => sum + (s.kills || 0), 0);
    const killPoints = totalKills;
    const matchesPlayed = teamData.length;
    const firstPlaceWins = teamData.filter((s) => s.placement === 1).length;

    const { error: teamUpdateError } = await supabase
      .from("teams")
      .update({
        total_points: totalPoints,
        placement_points: placementPoints,
        kill_points: killPoints,
        total_kills: totalKills,
        matches_played: matchesPlayed,
        first_place_wins: firstPlaceWins,
      })
      .eq("id", selectedScreenshot.team_id);

    if (teamUpdateError) {
      toast.error("Failed to update team stats");
    } else {
      toast.success("Screenshot updated successfully!");
      setEditDialogOpen(false);
      fetchScreenshots();
    }

    setUpdating(false);
  };

  const handleManualEntry = async () => {
    if (!manualTeamId) {
      toast.error("Please select a team");
      return;
    }

    // Validate inputs
    const matchDataSchema = z.object({
      matchNumber: z.number().int().min(1).max(100),
      placement: z.number().int().min(1).max(18),
      kills: z.number().int().min(0).max(50)
    });

    try {
      matchDataSchema.parse({ 
        matchNumber: manualMatchNumber,
        placement: manualPlacement, 
        kills: manualKills 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setSaving(true);

    const points = calculatePoints(manualPlacement, manualKills);

    // Insert manual entry without screenshot_url
    const { error: insertError } = await supabase
      .from("match_screenshots")
      .insert({
        team_id: manualTeamId,
        match_number: manualMatchNumber,
        placement: manualPlacement,
        kills: manualKills,
        points: points,
        screenshot_url: null, // Manual entry
      });

    if (insertError) {
      toast.error("Failed to save manual entry");
      console.error("Insert error:", insertError);
      setSaving(false);
      return;
    }

    // Recalculate team stats
    const { data: teamData, error: teamError } = await supabase
      .from("match_screenshots")
      .select("*")
      .eq("team_id", manualTeamId);

    if (teamError) {
      toast.error("Failed to recalculate team stats");
      setSaving(false);
      return;
    }

    const totalPoints = teamData.reduce((sum, s) => sum + (s.points || 0), 0);
    const placementPoints = teamData.reduce((sum, s) => {
      const placement = s.placement || 0;
      const points = calculatePoints(placement, 0);
      return sum + points;
    }, 0);
    const totalKills = teamData.reduce((sum, s) => sum + (s.kills || 0), 0);
    const killPoints = totalKills;
    const matchesPlayed = teamData.length;
    const firstPlaceWins = teamData.filter((s) => s.placement === 1).length;

    const { error: teamUpdateError } = await supabase
      .from("teams")
      .update({
        total_points: totalPoints,
        placement_points: placementPoints,
        kill_points: killPoints,
        total_kills: totalKills,
        matches_played: matchesPlayed,
        first_place_wins: firstPlaceWins,
      })
      .eq("id", manualTeamId);

    if (teamUpdateError) {
      toast.error("Failed to update team stats");
    } else {
      toast.success("Manual entry saved successfully!");
      setManualEntryDialogOpen(false);
      setManualTeamId("");
      setManualMatchNumber(1);
      setManualPlacement(1);
      setManualKills(0);
      fetchScreenshots();
    }

    setSaving(false);
  };

  const handleDeleteClick = (screenshot: MatchScreenshot) => {
    setScreenshotToDelete(screenshot);
    setDeleteDialogOpen(true);
  };

  const handleDeleteScreenshot = async () => {
    if (!screenshotToDelete) return;

    setDeleting(true);

    const { error } = await supabase
      .from("match_screenshots")
      .delete()
      .eq("id", screenshotToDelete.id);

    if (error) {
      toast.error("Failed to delete screenshot");
      console.error("Delete error:", error);
      setDeleting(false);
      return;
    }

    toast.success("Screenshot deleted successfully!");
    setDeleteDialogOpen(false);
    setScreenshotToDelete(null);
    setDeleting(false);
    fetchScreenshots();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group screenshots by team
  const groupedByTeam = screenshots.reduce((acc, screenshot) => {
    const teamName = screenshot.team_name;
    if (!acc[teamName]) {
      acc[teamName] = [];
    }
    acc[teamName].push(screenshot);
    return acc;
  }, {} as Record<string, MatchScreenshot[]>);

  // Sort team names alphabetically
  const sortedTeamNames = Object.keys(groupedByTeam).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-rajdhani font-bold text-foreground">Screenshot Verification</h2>
        <Button onClick={() => setManualEntryDialogOpen(true)} className="btn-glow">
          <Plus className="h-4 w-4 mr-2" />
          Add Manual Entry
        </Button>
      </div>

      {screenshots.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-barlow">
          No screenshots uploaded yet
        </p>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {sortedTeamNames.map((teamName) => {
            const teamScreenshots = groupedByTeam[teamName];
            return (
              <AccordionItem key={teamName} value={teamName} className="border border-primary/20 rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-rajdhani font-bold text-lg text-foreground">{teamName}</span>
                    <span className="text-sm text-muted-foreground font-barlow">
                      {teamScreenshots.length} screenshot{teamScreenshots.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
                    {teamScreenshots.map((screenshot) => (
                      <div key={screenshot.id} className="card-tactical p-4 space-y-3 border-2 border-primary/20 hover-lift">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-muted-foreground font-barlow">Match {screenshot.match_number}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleViewImage(screenshot)}
                              className="hover:border-primary/50"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleEditClick(screenshot)}
                              className="btn-glow"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleDeleteClick(screenshot)}
                              className="hover:border-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm border-t border-border/30 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground font-barlow">Placement:</span>
                            <span className="font-rajdhani font-bold text-foreground">{screenshot.placement || "Not set"}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground font-barlow">Kills:</span>
                            <span className="kill-feed">{screenshot.kills || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground font-barlow">Points:</span>
                            <span className="stat-counter">{screenshot.points || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Match Results</DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <div className="space-y-4">
              <div>
                <Label>Team: {selectedScreenshot.team_name}</Label>
              </div>
              <div>
                <Label>Match: {selectedScreenshot.match_number}</Label>
              </div>
              <div>
                <Label htmlFor="placement">Placement (1-18)</Label>
                <Select
                  value={editPlacement.toString()}
                  onValueChange={(value) => setEditPlacement(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kills">Kills</Label>
                <Input
                  id="kills"
                  type="number"
                  min="0"
                  value={editKills}
                  onChange={(e) => setEditKills(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Total Points: {calculatePoints(editPlacement, editKills)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateScreenshot} disabled={updating}>
              {updating ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedScreenshot?.team_name} - Match {selectedScreenshot?.match_number}
            </DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <div className="flex justify-center">
              <img
                src={selectedScreenshot.screenshot_url}
                alt="Match Screenshot"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualEntryDialogOpen} onOpenChange={setManualEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team">Team</Label>
              <Select value={manualTeamId} onValueChange={setManualTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="matchNumber">Match Number</Label>
              <Input
                id="matchNumber"
                type="number"
                min="1"
                value={manualMatchNumber}
                onChange={(e) => setManualMatchNumber(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label htmlFor="manualPlacement">Placement (1-18)</Label>
              <Select
                value={manualPlacement.toString()}
                onValueChange={(value) => setManualPlacement(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manualKills">Kills</Label>
              <Input
                id="manualKills"
                type="number"
                min="0"
                value={manualKills}
                onChange={(e) => setManualKills(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Total Points: {calculatePoints(manualPlacement, manualKills)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualEntryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualEntry} disabled={saving}>
              {saving ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screenshot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this screenshot? This will also update the team's points accordingly. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteScreenshot} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ScreenshotVerification;
