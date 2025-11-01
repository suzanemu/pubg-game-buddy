import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Calculator } from "lucide-react";
import { PLACEMENT_POINTS, KILL_POINTS } from "@/types/tournament";

interface Team {
  id: string;
  name: string;
}

interface ManualPointsEntryProps {
  selectedTournament: string;
}

const ManualPointsEntry = ({ selectedTournament }: ManualPointsEntryProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [matchNumber, setMatchNumber] = useState<string>("");
  const [placement, setPlacement] = useState<string>("");
  const [kills, setKills] = useState<string>("");
  const [calculatedPoints, setCalculatedPoints] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();
    }
  }, [selectedTournament]);

  useEffect(() => {
    // Calculate points when placement or kills change
    const placementNum = parseInt(placement) || 0;
    const killsNum = parseInt(kills) || 0;
    const placementPts = PLACEMENT_POINTS[placementNum] || 0;
    const killPts = killsNum * KILL_POINTS;
    setCalculatedPoints(placementPts + killPts);
  }, [placement, kills]);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name")
      .eq("tournament_id", selectedTournament);

    if (error) {
      console.error("Error fetching teams:", error);
      return;
    }

    setTeams(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam || !matchNumber || !placement || kills === "") {
      toast.error("Please fill in all fields");
      return;
    }

    const placementNum = parseInt(placement);
    const killsNum = parseInt(kills);
    const matchNum = parseInt(matchNumber);

    if (placementNum < 1 || placementNum > 18) {
      toast.error("Placement must be between 1 and 18");
      return;
    }

    if (killsNum < 0) {
      toast.error("Kills cannot be negative");
      return;
    }

    if (matchNum < 1) {
      toast.error("Match number must be at least 1");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("match_screenshots")
        .insert({
          team_id: selectedTeam,
          match_number: matchNum,
          placement: placementNum,
          kills: killsNum,
          points: calculatedPoints,
          screenshot_url: null, // No screenshot for manual entry
        });

      if (error) {
        throw error;
      }

      toast.success("Points added successfully");
      
      // Reset form
      setSelectedTeam("");
      setMatchNumber("");
      setPlacement("");
      setKills("");
      setCalculatedPoints(0);
    } catch (error) {
      console.error("Error adding points:", error);
      toast.error("Failed to add points");
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedTournament) {
    return (
      <Card className="card-tactical p-8 border-2 border-primary/20">
        <p className="text-center text-muted-foreground font-barlow">
          Please select a tournament first
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Plus className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-rajdhani font-black uppercase tracking-wider">
          Manual Points Entry
        </h2>
      </div>

      <Card className="card-tactical p-6 border-2 border-primary/20">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="team" className="font-rajdhani font-bold uppercase">
                Team
              </Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger id="team" className="border-primary/30">
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

            <div className="space-y-2">
              <Label htmlFor="matchNumber" className="font-rajdhani font-bold uppercase">
                Match Number
              </Label>
              <Input
                id="matchNumber"
                type="number"
                min="1"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                placeholder="Enter match number"
                className="border-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="placement" className="font-rajdhani font-bold uppercase">
                Placement (1-18)
              </Label>
              <Input
                id="placement"
                type="number"
                min="1"
                max="18"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                placeholder="Enter placement"
                className="border-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kills" className="font-rajdhani font-bold uppercase">
                Kills
              </Label>
              <Input
                id="kills"
                type="number"
                min="0"
                value={kills}
                onChange={(e) => setKills(e.target.value)}
                placeholder="Enter kills"
                className="border-primary/30"
              />
            </div>
          </div>

          {(placement || kills) && (
            <div className="card-tactical p-4 border border-primary/30 bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="font-rajdhani font-bold uppercase text-sm text-muted-foreground">
                  Calculated Points
                </span>
              </div>
              <div className="space-y-1 text-sm font-barlow">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Placement Points:</span>
                  <span className="font-bold">{PLACEMENT_POINTS[parseInt(placement) || 0] || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kill Points:</span>
                  <span className="font-bold">{(parseInt(kills) || 0) * KILL_POINTS}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-primary/20">
                  <span className="font-rajdhani font-bold uppercase">Total Points:</span>
                  <span className="text-xl font-rajdhani font-black text-primary">{calculatedPoints}</span>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !selectedTeam || !matchNumber || !placement || kills === ""}
            className="w-full btn-glow"
          >
            {submitting ? "Adding Points..." : "Add Points"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ManualPointsEntry;
