import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, LogOut, Loader2, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Standings from "./Standings";
import { Team, Tournament } from "@/types/tournament";

interface PlayerDashboardProps {
  userId: string;
}

const PlayerDashboard = ({ userId }: PlayerDashboardProps) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matchNumber, setMatchNumber] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadedMatches, setUploadedMatches] = useState<number>(0);

  useEffect(() => {
    fetchUserTeam();
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
    };

    setUserTeam(mappedTeam);

    const { data: screenshotsData } = await supabase
      .from("match_screenshots")
      .select("match_number")
      .eq("team_id", sessionData.team_id);

    setUploadedMatches(screenshotsData?.length || 0);
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
    }));

    setTeams(mappedTeams);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userTeam) return;

    if (tournament && matchNumber > tournament.total_matches) {
      toast.error(`Match number cannot exceed ${tournament.total_matches}`);
      return;
    }

    const { data: existing } = await supabase
      .from("match_screenshots")
      .select("id")
      .eq("team_id", userTeam.id)
      .eq("match_number", matchNumber)
      .single();

    if (existing) {
      toast.error(`You have already uploaded a screenshot for Match ${matchNumber}`);
      return;
    }

    setUploading(true);
    setUploadProgress("Uploading screenshot...");

    const fileExt = file.name.split(".").pop();
    const fileName = `${userTeam.id}/${matchNumber}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Failed to upload screenshot");
      setUploading(false);
      setUploadProgress("");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("screenshots")
      .getPublicUrl(fileName);

    setUploadProgress("Saving match data...");

    const { error: insertError } = await supabase.from("match_screenshots").insert({
      team_id: userTeam.id,
      match_number: matchNumber,
      screenshot_url: urlData.publicUrl,
    });

    if (insertError) {
      toast.error("Failed to save match screenshot");
    } else {
      toast.success(`Screenshot uploaded for Match ${matchNumber}!`);
      setMatchNumber(matchNumber + 1);
      fetchUserTeam();
    }

    setUploading(false);
    setUploadProgress("");
    event.target.value = "";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!userTeam) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {userTeam.name}
            </h1>
            {tournament && (
              <p className="text-sm text-muted-foreground">{tournament.name}</p>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 bg-gradient-to-br from-card to-card/50">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Team Stats
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Points</span>
                <span className="font-bold text-lg text-primary">{userTeam.totalPoints}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Placement Points</span>
                <span className="font-semibold">{userTeam.placementPoints}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kill Points</span>
                <span className="font-semibold">{userTeam.killPoints}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Kills</span>
                <span className="font-semibold">{userTeam.totalKills}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matches Played</span>
                <span className="font-semibold">{userTeam.matchesPlayed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chicken Dinners</span>
                <span className="font-semibold">{userTeam.firstPlaceWins}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-accent" />
              Upload Screenshot
            </h2>
            {tournament && uploadedMatches >= tournament.total_matches ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have uploaded all {tournament.total_matches} matches for this tournament.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="matchNumber">Match Number</Label>
                  <Input
                    id="matchNumber"
                    type="number"
                    min="1"
                    max={tournament?.total_matches || 6}
                    value={matchNumber}
                    onChange={(e) => setMatchNumber(parseInt(e.target.value) || 1)}
                    disabled={uploading}
                  />
                </div>
                <div>
                  <Label htmlFor="screenshot">Screenshot</Label>
                  <Input
                    id="screenshot"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Upload a screenshot of your match results. Admin will verify and update the points.
                </p>
              </div>
            )}
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Tournament Standings</h2>
          <Standings teams={teams} />
        </div>
      </main>
    </div>
  );
};

export default PlayerDashboard;
