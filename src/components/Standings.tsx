import { Trophy, Award, Crown } from "lucide-react";
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
    const height = isFirst ? "h-80" : "h-64";
    const badgeColor = rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-card" : "bg-card";
    
    return (
      <div className={`relative ${height} flex flex-col items-center justify-end pb-8`}>
        {/* Team Logo Circle */}
        <div className={`${isFirst ? 'w-32 h-32 mb-6' : 'w-24 h-24 mb-4'} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg`}>
          {isFirst ? (
            <Crown className="w-16 h-16 text-background" />
          ) : (
            <Trophy className={`${isFirst ? 'w-12 h-12' : 'w-10 h-10'} text-background`} />
          )}
        </div>
        
        {/* Team Name */}
        <h3 className={`${isFirst ? 'text-2xl' : 'text-xl'} font-bold text-foreground mb-2 text-center`}>
          {team.name}
        </h3>
        
        {/* Rank Badge */}
        <div className={`${badgeColor} px-4 py-1 rounded-md mb-4`}>
          <span className="text-xl font-bold text-foreground">#{rank}</span>
        </div>
        
        {/* Stats Container */}
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 w-full border border-border">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground font-bold mb-1">ELIMS</div>
              <div className="text-lg font-bold text-foreground">{team.totalKills}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-bold mb-1">PLACEMENT</div>
              <div className="text-lg font-bold text-foreground">{team.placementPoints}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-bold mb-1">WWCD</div>
              <div className="text-lg font-bold text-foreground">{team.firstPlaceWins}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-bold mb-1">TOTAL</div>
              <div className="text-lg font-bold text-primary">{team.totalPoints}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-l-4 border-primary pl-4">
        <h2 className="text-3xl font-bold text-foreground">TEAM RANKING</h2>
      </div>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {/* Rank 2 */}
          {top3[1] && (
            <div className="order-1 md:order-1">
              <PodiumCard team={top3[1]} rank={2} />
            </div>
          )}
          
          {/* Rank 1 */}
          {top3[0] && (
            <div className="order-2 md:order-2">
              <PodiumCard team={top3[0]} rank={1} />
            </div>
          )}
          
          {/* Rank 3 */}
          {top3[2] && (
            <div className="order-3 md:order-3">
              <PodiumCard team={top3[2]} rank={3} />
            </div>
          )}
        </div>
      )}

      {/* Remaining Teams Table */}
      {remaining.length > 0 && (
        <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-card/80 hover:bg-card/80 border-b border-border">
                <TableHead className="text-muted-foreground font-bold w-20">RANK</TableHead>
                <TableHead className="text-muted-foreground font-bold">TEAM</TableHead>
                <TableHead className="text-muted-foreground font-bold text-center">ELIMS</TableHead>
                <TableHead className="text-muted-foreground font-bold text-center">PLACEMENT</TableHead>
                <TableHead className="text-muted-foreground font-bold text-center">WWCD</TableHead>
                <TableHead className="text-muted-foreground font-bold text-center">TOTAL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remaining.map((team, index) => (
                <TableRow key={team.id} className="hover:bg-card/60 border-b border-border/50">
                  <TableCell className="font-bold text-muted-foreground">
                    #{index + 4}
                  </TableCell>
                  <TableCell className="font-bold text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-foreground" />
                      </div>
                      {team.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-foreground">{team.totalKills}</TableCell>
                  <TableCell className="text-center font-semibold text-foreground">{team.placementPoints}</TableCell>
                  <TableCell className="text-center font-semibold text-foreground">{team.firstPlaceWins}</TableCell>
                  <TableCell className="text-center font-bold text-primary">{team.totalPoints}</TableCell>
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
