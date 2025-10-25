import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, LogIn, Target, Award } from "lucide-react";
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 tactical-grid opacity-10 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none"></div>
      
      {/* Header with Login Button */}
      <header className="sticky top-0 z-50 border-b-2 border-primary/20 bg-card/80 backdrop-blur-md shadow-glow-orange">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-lg opacity-50"></div>
                <div className="relative p-2 bg-gradient-primary rounded-lg">
                  <Trophy className="h-7 w-7 text-background" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-rajdhani font-bold bg-gradient-primary bg-clip-text text-transparent">
                  PUBG TOURNAMENT
                </h1>
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Live Leaderboard
                </p>
              </div>
            </div>
            <Button 
              onClick={() => navigate("/auth")} 
              className="gap-2 btn-glow bg-gradient-primary hover:opacity-90 h-11 px-6 font-rajdhani font-bold uppercase tracking-wider"
            >
              <LogIn className="h-5 w-5" />
              Enter
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative border-b border-primary/20 bg-gradient-to-r from-card via-secondary to-card py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 text-center">
            <Award className="h-6 w-6 text-primary animate-pulse" />
            <h2 className="text-2xl font-rajdhani font-bold text-foreground">
              BATTLE FOR VICTORY
            </h2>
            <Award className="h-6 w-6 text-accent animate-pulse" />
          </div>
          <p className="text-center text-muted-foreground mt-2 font-barlow">
            Real-time tournament standings • Updated live
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-8 max-w-7xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
              <div className="relative h-16 w-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
            <p className="text-muted-foreground font-rajdhani uppercase tracking-wider">Loading standings...</p>
          </div>
        ) : teams.length > 0 ? (
          <Standings teams={teams} />
        ) : (
          <div className="text-center py-16">
            <div className="card-tactical p-12 max-w-md mx-auto">
              <Trophy className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-xl font-rajdhani font-semibold text-foreground mb-2">
                No Teams Registered
              </p>
              <p className="text-muted-foreground font-barlow">
                Tournament has not started yet
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Accent */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-30 pointer-events-none"></div>
    </div>
  );
};

export default Home;
