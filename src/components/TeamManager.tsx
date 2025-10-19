import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Tournament } from "@/types/tournament";

interface Team {
  id: string;
  name: string;
  access_code?: string;
}

export default function TeamManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [newTeamName, setNewTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();
    }
  }, [selectedTournament]);

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tournaments:", error);
      return;
    }

    setTournaments(data || []);
    if (data && data.length > 0 && !selectedTournament) {
      setSelectedTournament(data[0].id);
    }
  };

  const fetchTeams = async () => {
    if (!selectedTournament) return;

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", selectedTournament)
      .order("name");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return;
    }

    const teamsWithCodes: Team[] = await Promise.all(
      (teamsData || []).map(async (team) => {
        const { data: codeData } = await supabase
          .from("access_codes")
          .select("code")
          .eq("team_id", team.id)
          .eq("role", "player")
          .single();

        return {
          ...team,
          access_code: codeData?.code,
        };
      })
    );

    setTeams(teamsWithCodes);
  };

  const generateAccessCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTeamName.trim()) {
      toast.error("Team name is required");
      return;
    }

    if (!selectedTournament) {
      toast.error("Please select a tournament first");
      return;
    }

    setLoading(true);

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: newTeamName,
        tournament_id: selectedTournament,
      })
      .select()
      .single();

    if (teamError) {
      toast.error("Failed to create team");
      setLoading(false);
      return;
    }

    const accessCode = generateAccessCode();

    const { error: codeError } = await supabase.from("access_codes").insert({
      code: accessCode,
      role: "player",
      team_id: teamData.id,
    });

    if (codeError) {
      toast.error("Failed to create access code");
    } else {
      toast.success("Team created successfully!");
      setNewTeamName("");
      fetchTeams();
    }

    setLoading(false);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team?")) {
      return;
    }

    const { error } = await supabase.from("teams").delete().eq("id", teamId);

    if (error) {
      toast.error("Failed to delete team");
    } else {
      toast.success("Team deleted successfully!");
      fetchTeams();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Access code copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4">
          <Label>Select Tournament</Label>
          <Select value={selectedTournament} onValueChange={setSelectedTournament}>
            <SelectTrigger>
              <SelectValue placeholder="Select a tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((tournament) => (
                <SelectItem key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <Label htmlFor="teamName">Team Name</Label>
            <div className="flex gap-2">
              <Input
                id="teamName"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                disabled={loading || !selectedTournament}
              />
              <Button type="submit" disabled={loading || !selectedTournament}>
                <Plus className="h-4 w-4 mr-2" />
                Add Team
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Teams</h3>
        <div className="space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{team.name}</p>
                {team.access_code && (
                  <p className="text-sm text-muted-foreground">Code: {team.access_code}</p>
                )}
              </div>
              <div className="flex gap-2">
                {team.access_code && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(team.access_code!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => handleDeleteTeam(team.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {teams.length === 0 && selectedTournament && (
            <p className="text-center text-muted-foreground py-8">No teams yet</p>
          )}
          {!selectedTournament && (
            <p className="text-center text-muted-foreground py-8">Please select a tournament</p>
          )}
        </div>
      </Card>
    </div>
  );
}
