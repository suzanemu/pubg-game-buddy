import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, LogIn } from "lucide-react";
import Standings from "@/components/Standings";
import { Team } from "@/types/tournament";

const Home = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('teams-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams'
        },
        () => {
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("total_points", { ascending: false });

    if (!error && data) {
      const formattedTeams: Team[] = data.map((team) => ({
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
      setTeams(formattedTeams);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Login Button */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">PUBG Tournament</h1>
          </div>
          <Button onClick={() => navigate("/auth")} className="gap-2">
            <LogIn className="h-4 w-4" />
            Login
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : teams.length > 0 ? (
          <Standings teams={teams} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No teams registered yet.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
