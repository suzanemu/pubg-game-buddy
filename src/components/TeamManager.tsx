import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { Tournament } from "@/types/tournament";

interface Team {
  id: string;
  name: string;
  access_code?: string;
  logo_url?: string;
}

export default function TeamManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [newTeamName, setNewTeamName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
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

    let logoUrl: string | undefined;

    // Upload logo if provided
    if (logoFile) {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${Date.now()}-${newTeamName.replace(/\s+/g, "-")}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("team-logos")
        .upload(fileName, logoFile);

      if (uploadError) {
        toast.error("Failed to upload logo");
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("team-logos")
        .getPublicUrl(fileName);

      logoUrl = urlData.publicUrl;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: newTeamName,
        tournament_id: selectedTournament,
        logo_url: logoUrl,
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
      setLogoFile(null);
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
      <div className="card-tactical p-6 border-2 border-primary/20">
        <div className="mb-4">
          <Label className="font-rajdhani font-bold uppercase text-sm">Select Tournament</Label>
          <Select value={selectedTournament} onValueChange={setSelectedTournament}>
            <SelectTrigger className="border-primary/30">
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
            <Label htmlFor="teamName" className="font-rajdhani font-bold uppercase text-sm">Team Name</Label>
            <Input
              id="teamName"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter team name"
              disabled={loading || !selectedTournament}
              className="border-primary/30"
            />
          </div>
          
          <div>
            <Label htmlFor="teamLogo" className="font-rajdhani font-bold uppercase text-sm">Team Logo (Optional)</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="teamLogo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                disabled={loading || !selectedTournament}
                className="border-primary/30"
              />
              {logoFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  {logoFile.name}
                </div>
              )}
            </div>
          </div>

          <Button type="submit" disabled={loading || !selectedTournament} className="btn-glow w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Team
          </Button>
        </form>
      </div>

      <div className="card-tactical p-6 border-2 border-primary/20">
        <h3 className="font-rajdhani font-bold uppercase tracking-wide text-xl mb-4">Teams</h3>
        <div className="space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between p-4 border-2 border-border/30 rounded-lg hover:border-primary/30 transition-colors bg-secondary/20">
              <div className="flex items-center gap-3">
                {team.logo_url ? (
                  <img 
                    src={team.logo_url} 
                    alt={`${team.name} logo`}
                    className="w-12 h-12 rounded-lg object-cover border-2 border-primary/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-primary/20 flex items-center justify-center border border-primary/30">
                    <ImageIcon className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-rajdhani font-bold text-lg text-foreground">{team.name}</p>
                  {team.access_code && (
                    <p className="text-sm text-muted-foreground font-mono">Code: {team.access_code}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {team.access_code && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(team.access_code!)}
                    className="hover:border-primary/50"
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
            <p className="text-center text-muted-foreground py-8 font-barlow">No teams yet</p>
          )}
          {!selectedTournament && (
            <p className="text-center text-muted-foreground py-8 font-barlow">Please select a tournament</p>
          )}
        </div>
      </div>
    </div>
  );
}
