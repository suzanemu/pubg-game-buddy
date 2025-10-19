import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeamManager from "./TeamManager";
import TournamentManager from "./TournamentManager";
import ScreenshotVerification from "./ScreenshotVerification";
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
    }));

    setTeams(mappedTeams);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            {selectedTournament && (
              <div className="mt-2">
                <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                  <SelectTrigger className="w-[250px]">
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
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="verify">Verify Screenshots</TabsTrigger>
            <TabsTrigger value="teams">Manage Teams</TabsTrigger>
            <TabsTrigger value="tournaments">Manage Tournaments</TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="space-y-4">
            <Standings teams={teams} />
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
