import { Trophy, Award, Crown, Target, Crosshair } from "lucide-react";
import { Team } from "@/types/tournament";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StandingsProps {
  teams: Team[];
}

const Standings = ({ teams }: StandingsProps) => {
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return b.totalKills - a.totalKills;
  });

  const top3 = sortedTeams.slice(0, 3);
  const remaining = sortedTeams.slice(3);

  const PodiumCard = ({ team, rank }: { team: Team; rank: number }) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;
    
    const height = isFirst ? "h-96" : isSecond ? "h-80" : "h-72";
    const titleSize = isFirst ? "text-3xl" : isSecond ? "text-2xl" : "text-xl";
    
    const getRankClass = () => {
      if (isFirst) return "rank-gold";
      if (isSecond) return "rank-silver";
      return "rank-bronze";
    };
    
    return (
      <div className={`relative ${height} flex flex-col items-center justify-end pb-6 group`}>
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-500 rounded-lg"></div>
        
        {/* Rank Number Background */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div className={`${getRankClass()} ${isFirst ? 'w-16 h-16' : 'w-14 h-14'} rounded-full flex items-center justify-center font-rajdhani font-black text-2xl border-4 border-background shadow-xl`}>
            {rank}
          </div>
        </div>
        
        {/* Team Logo */}
        <div className={`${isFirst ? 'w-36 h-36 mb-6' : isSecond ? 'w-28 h-28 mb-5' : 'w-24 h-24 mb-4'} relative rounded-full flex items-center justify-center`}>
          <div className="absolute inset-0 bg-gradient-primary rounded-full animate-pulse opacity-50 blur-lg"></div>
          <div className="relative w-full h-full bg-gradient-primary rounded-full flex items-center justify-center border-4 border-background shadow-glow-orange overflow-hidden">
            {team.logo_url ? (
              <img 
                src={team.logo_url} 
                alt={`${team.name} logo`}
                className="w-full h-full object-cover"
              />
            ) : (
              isFirst ? (
                <Crown className={`${isFirst ? 'w-20 h-20' : isSecond ? 'w-16 h-16' : 'w-14 h-14'} text-background drop-shadow-lg`} />
              ) : (
                <Trophy className={`${isFirst ? 'w-20 h-20' : isSecond ? 'w-16 h-16' : 'w-14 h-14'} text-background drop-shadow-lg`} />
              )
            )}
          </div>
        </div>
        
        {/* Team Name */}
        <h3 className={`${titleSize} font-rajdhani font-black text-foreground mb-3 text-center px-4 relative`}>
          <span className="relative z-10">{team.name}</span>
          {isFirst && (
            <div className="absolute inset-0 bg-gradient-primary blur-xl opacity-20"></div>
          )}
        </h3>
        
        {/* Stats Container */}
        <div className="card-tactical p-5 w-full border-2 group-hover:border-primary/30 transition-all duration-300 hover-lift">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <Crosshair className="w-3 h-3 text-destructive" />
                <div className="text-xs text-muted-foreground font-rajdhani font-bold uppercase tracking-wide">Elims</div>
              </div>
              <div className={`${isFirst ? 'text-2xl' : 'text-xl'} font-rajdhani font-bold text-foreground`}>
                {team.totalKills}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-rajdhani font-bold uppercase tracking-wide">Place</div>
              <div className={`${isFirst ? 'text-2xl' : 'text-xl'} font-rajdhani font-bold text-foreground`}>
                {team.placementPoints}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <Crown className="w-3 h-3 text-accent" />
                <div className="text-xs text-muted-foreground font-rajdhani font-bold uppercase tracking-wide">WWCD</div>
              </div>
              <div className={`${isFirst ? 'text-2xl' : 'text-xl'} font-rajdhani font-bold text-foreground`}>
                {team.firstPlaceWins}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-primary font-rajdhani font-bold uppercase tracking-wide">Total</div>
              <div className={`${isFirst ? 'text-3xl stat-counter' : 'text-2xl font-rajdhani font-bold text-primary'}`}>
                {team.totalPoints}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-gradient-primary rounded-r-full blur-sm"></div>
        <div className="border-l-4 border-primary pl-6">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <h2 className="text-4xl font-rajdhani font-black text-foreground uppercase tracking-wider">
              Team Rankings
            </h2>
          </div>
          <p className="text-muted-foreground font-barlow mt-1 ml-11">Live tournament standings</p>
        </div>
      </div>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="relative">
          {/* Podium Base Effect */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent rounded-lg blur-xl"></div>
          
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            {/* Rank 2 - Left */}
            {top3[1] && (
              <div className="order-1 md:order-1 transform md:translate-y-6">
                <PodiumCard team={top3[1]} rank={2} />
              </div>
            )}
            
            {/* Rank 1 - Center */}
            {top3[0] && (
              <div className="order-2 md:order-2 transform scale-105">
                <PodiumCard team={top3[0]} rank={1} />
              </div>
            )}
            
            {/* Rank 3 - Right */}
            {top3[2] && (
              <div className="order-3 md:order-3 transform md:translate-y-10">
                <PodiumCard team={top3[2]} rank={3} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remaining Teams Table */}
      {remaining.length > 0 && (
        <div className="card-tactical border-2 overflow-hidden">
          <div className="bg-gradient-tactical p-4 border-b-2 border-border/50">
            <h3 className="font-rajdhani font-bold text-xl uppercase tracking-wider flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Other Competitors
            </h3>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50 border-b-2 border-primary/20">
                <TableHead className="text-muted-foreground font-rajdhani font-bold text-sm uppercase tracking-wider w-24">
                  Rank
                </TableHead>
                <TableHead className="text-muted-foreground font-rajdhani font-bold text-sm uppercase tracking-wider">
                  Team Name
                </TableHead>
                <TableHead className="text-muted-foreground font-rajdhani font-bold text-sm uppercase tracking-wider text-center">
                  Elims
                </TableHead>
                <TableHead className="text-muted-foreground font-rajdhani font-bold text-sm uppercase tracking-wider text-center">
                  Place
                </TableHead>
                <TableHead className="text-muted-foreground font-rajdhani font-bold text-sm uppercase tracking-wider text-center">
                  WWCD
                </TableHead>
                <TableHead className="text-muted-foreground font-rajdhani font-bold text-sm uppercase tracking-wider text-center">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remaining.map((team, index) => (
                <TableRow 
                  key={team.id} 
                  className="hover:bg-secondary/30 border-b border-border/30 transition-colors group"
                >
                  <TableCell className="font-rajdhani font-bold text-lg text-muted-foreground group-hover:text-primary transition-colors">
                    #{index + 4}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {team.logo_url ? (
                        <img 
                          src={team.logo_url} 
                          alt={`${team.name} logo`}
                          className="w-10 h-10 rounded-lg object-cover border border-primary/30 group-hover:border-primary/50 transition-colors"
                        />
                      ) : (
                        <div className="relative w-10 h-10 rounded-lg bg-gradient-primary/20 flex items-center justify-center border border-primary/30 group-hover:border-primary/50 transition-colors">
                          <Trophy className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <span className="font-rajdhani font-bold text-lg text-foreground">
                        {team.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-rajdhani font-bold text-lg text-foreground inline-flex items-center gap-1">
                      <Crosshair className="w-4 h-4 text-destructive/60" />
                      {team.totalKills}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-rajdhani font-bold text-lg text-foreground">
                    {team.placementPoints}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-rajdhani font-bold text-lg text-foreground inline-flex items-center gap-1 justify-center">
                      {team.firstPlaceWins > 0 && <Crown className="w-4 h-4 text-accent" />}
                      {team.firstPlaceWins}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-rajdhani font-black text-xl bg-gradient-primary bg-clip-text text-transparent">
                      {team.totalPoints}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Standings;
