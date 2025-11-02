import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeamManager from "./TeamManager";
import TournamentManager from "./TournamentManager";
import ScreenshotVerification from "./ScreenshotVerification";
import ManualPointsEntry from "./ManualPointsEntry";
import Standings from "./Standings";
import { Team, Tournament } from "@/types/tournament";

interface AdminDashboardProps {
  userId: string;
}

const AdminDashboard = ({ userId }: AdminDashboardProps) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();

      // Set up real-time subscription for team updates
      const channel = supabase
        .channel('teams-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'teams',
          },
          () => {
            // Refetch teams when any team is updated
            fetchTeams();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", selectedTournament);

    if (error) {
      console.error("Error fetching teams:", error);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background tactical-grid">
      <header className="border-b-2 border-primary/30 bg-gradient-tactical backdrop-blur-sm sticky top-0 z-50 shadow-glow-orange">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-rajdhani font-black text-foreground uppercase tracking-wider">
                <span className="bg-gradient-primary bg-clip-text text-transparent">Admin Dashboard</span>
              </h1>
              {selectedTournament && (
                <div className="mt-2">
                  <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                    <SelectTrigger className="w-full sm:w-[250px] border-primary/30">
                      <SelectValue placeholder="Select Tournament" />
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
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/")} className="btn-glow flex-1 sm:flex-initial" size="sm">
                <Home className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Button>
              <Button variant="outline" onClick={handleLogout} className="flex-1 sm:flex-initial" size="sm">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Tabs defaultValue="standings" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-5 bg-secondary/50 border-2 border-primary/20">
              <TabsTrigger value="standings" className="font-rajdhani font-bold uppercase text-xs sm:text-sm whitespace-nowrap">Standings</TabsTrigger>
              <TabsTrigger value="manual" className="font-rajdhani font-bold uppercase text-xs sm:text-sm whitespace-nowrap">Manual</TabsTrigger>
              <TabsTrigger value="verify" className="font-rajdhani font-bold uppercase text-xs sm:text-sm whitespace-nowrap">Verify</TabsTrigger>
              <TabsTrigger value="teams" className="font-rajdhani font-bold uppercase text-xs sm:text-sm whitespace-nowrap">Teams</TabsTrigger>
              <TabsTrigger value="tournaments" className="font-rajdhani font-bold uppercase text-xs sm:text-sm whitespace-nowrap">Tournaments</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="standings" className="space-y-4">
            <Standings teams={teams} isAdmin={true} onTeamsUpdate={fetchTeams} />
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <ManualPointsEntry selectedTournament={selectedTournament} />
          </TabsContent>

          <TabsContent value="verify" className="space-y-4">
            <ScreenshotVerification selectedTournament={selectedTournament} />
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <TeamManager />
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-4">
            <TournamentManager onTournamentSelect={(id) => setSelectedTournament(id || "")} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
