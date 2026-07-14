
export function RecommendationSkeleton({ count = 6 }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
 
        .skel-wrap {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          /* hide scrollbar during skeleton */
          scrollbar-width: none;
        }
        .skel-wrap::-webkit-scrollbar { display: none; }
 
        .skel-card {
          flex: 0 0 120px;
          border-radius: 10px;
          overflow: hidden;
          background: #f0f0f0;
        }
 
        .skel-pulse {
          background: linear-gradient(
            90deg,
            #e8e8e8 25%,
            #f5f5f5 50%,
            #e8e8e8 75%
          );
          background-size: 400px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
 
        .skel-cover {
          width: 120px;
          height: 160px;
          border-radius: 10px 10px 0 0;
        }
 
        .skel-body {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
 
        .skel-title {
          height: 11px;
          border-radius: 4px;
          width: 85%;
        }
 
        .skel-author {
          height: 10px;
          border-radius: 4px;
          width: 60%;
        }
 
        .skel-badge {
          height: 18px;
          border-radius: 20px;
          width: 50%;
          margin-top: 2px;
        }
      `}</style>
 
      <div className="skel-wrap">
        {Array.from({ length: count }).map((_, i) => (
          <div className="skel-card" key={i}>
            <div className="skel-cover skel-pulse" />
            <div className="skel-body">
              <div className="skel-title skel-pulse" />
              <div className="skel-author skel-pulse" />
              <div className="skel-badge skel-pulse" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}