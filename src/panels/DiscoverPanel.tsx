import React, { useEffect, useState, useRef } from 'react';
import { Download, Heart, Search, Sparkles, TrendingUp, Star, Filter } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Button } from '../components/Button';

interface Modpack {
  slug: string;
  title: string;
  description: string;
  downloads: number;
  followers: number;
  icon_url: string;
  color?: number;
  categories: string[];
  author: string;
  date_modified: string;
}

interface FeaturedItem {
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  color: string;
  downloads: number;
}

type ContentType = 'modpacks' | 'mods' | 'resource_packs' | 'data_packs' | 'shaders';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
    },
  },
};

export const DiscoverPanel: React.FC = () => {
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [activeTab, setActiveTab] = useState<ContentType>('modpacks');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const heroRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: true });

  useEffect(() => {
    fetchContent();
  }, [activeTab]);

  const fetchContent = async () => {
    setIsLoading(true);
    const projectType = activeTab === 'modpacks' ? 'modpack' : 
                       activeTab === 'mods' ? 'mod' : 'mod';
    
    try {
      const res = await fetch(
        `https://api.modrinth.com/v2/search?facets=[["project_type:${projectType}"]]&limit=20&index=downloads`
      );
      const data = await res.json();
      
      const items = (data.hits || []).map((hit: any) => ({
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        downloads: hit.downloads,
        followers: hit.follows || hit.followers || 0,
        icon_url: hit.icon_url,
        color: hit.color,
        categories: hit.categories || [],
        author: hit.author || hit.owner || 'Unknown',
        date_modified: hit.date_modified,
      }));

      // Use top 3 as featured
      setFeatured(items.slice(0, 3).map((item: Modpack) => ({
        slug: item.slug,
        title: item.title,
        description: item.description,
        icon_url: item.icon_url,
        color: item.color ? `#${item.color.toString(16).padStart(6, '0')}` : '#00a4ef',
        downloads: item.downloads,
      })));
      
      setModpacks(items);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDownloads = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  const tabs: { id: ContentType; label: string; icon: any }[] = [
    { id: 'modpacks', label: 'Modpacks', icon: Sparkles },
    { id: 'mods', label: 'Mods', icon: TrendingUp },
    { id: 'resource_packs', label: 'Resource Packs', icon: Star },
    { id: 'shaders', label: 'Shaders', icon: Sparkles },
    { id: 'data_packs', label: 'Data Packs', icon: Filter },
  ];

  return (
    <div className="h-full overflow-y-auto scroll-hide">
      {/* Hero Section - Featured Items */}
      <motion.section
        ref={heroRef}
        initial={{ opacity: 0, y: 30 }}
        animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="px-6 py-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-text-p" />
          <h2 className="text-sm font-bold text-text-p uppercase tracking-wider">Featured</h2>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {featured.map((item, index) => (
            <motion.div
              key={item.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="relative overflow-hidden rounded-2xl bg-inner2 border border-border cursor-pointer group"
              onClick={() => window.open(`https://modrinth.com/modpack/${item.slug}`, '_blank')}
            >
              {/* Gradient Background */}
              <div 
                className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30"
                style={{ 
                  background: `linear-gradient(135deg, ${item.color} 0%, transparent 60%)` 
                }}
              />
              
              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-inner3 border-2 border-border group-hover:border-text-p/30 transition-all">
                    {item.icon_url ? (
                      <img src={item.icon_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-text-p">
                        {item.title.charAt(0)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-p text-base mb-1 truncate">{item.title}</h3>
                    <p className="text-text-s text-xs line-clamp-2 mb-3">{item.description}</p>
                    
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-text-s">
                        <Download size={12} />
                        {formatDownloads(item.downloads)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Search & Filter Bar */}
      <div className="sticky top-0 z-20 bg-outer/95 backdrop-blur-sm border-y border-border px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-d" size={18} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-inner2 border border-border rounded-xl text-text-p placeholder:text-text-d outline-none focus:border-text-p transition-colors"
            />
          </div>
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-inner2 rounded-xl border border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-text-p text-black'
                      : 'text-text-s hover:text-text-p'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          
          {/* Filter Toggle */}
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 ${showFilters ? 'bg-text-p text-black' : ''}`}
          >
            <Filter size={16} />
          </Button>
        </div>
        
        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 pt-4">
                <span className="text-xs text-text-s uppercase tracking-wider">Sort by</span>
                <div className="flex items-center gap-2">
                  {['Relevance', 'Downloads', 'Followers', 'Newest'].map((sort) => (
                    <button
                      key={sort}
                      className="px-3 py-1.5 text-xs rounded-lg bg-inner2 border border-border text-text-s hover:border-text-p transition-colors"
                    >
                      {sort}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Grid */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse flex space-x-4">
              <div className="w-12 h-12 bg-inner3 rounded-xl" />
              <div className="space-y-2">
                <div className="w-32 h-4 bg-inner3 rounded" />
                <div className="w-48 h-3 bg-inner3 rounded" />
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-4"
          >
            <AnimatePresence mode="wait">
              {modpacks.map((item) => (
                <motion.div
                  key={item.slug}
                  variants={itemVariants}
                  layout
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="flex items-start gap-4 p-4 bg-inner2 border border-border rounded-xl cursor-pointer group hover:border-text-p/30 transition-colors"
                  onClick={() => window.open(`https://modrinth.com/${activeTab === 'modpacks' ? 'modpack' : 'mod'}/${item.slug}`, '_blank')}
                >
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-inner3 border-2 border-border group-hover:border-text-p/30 transition-all">
                    {item.icon_url ? (
                      <img src={item.icon_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-text-p">
                        {item.title.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-text-p text-base">{item.title}</h3>
                      <span className="text-text-s text-xs">by {item.author}</span>
                    </div>
                    <p className="text-text-s text-sm line-clamp-2 mb-2">{item.description}</p>
                    
                    {/* Categories */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.categories.slice(0, 3).map((cat) => (
                        <span 
                          key={cat} 
                          className="px-2 py-0.5 bg-inner3 border border-border rounded-md text-[10px] text-text-s"
                        >
                          {cat}
                        </span>
                      ))}
                      {item.categories.length > 3 && (
                        <span className="px-2 py-0.5 text-[10px] text-text-d">
                          +{item.categories.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3 text-xs text-text-s">
                      <span className="flex items-center gap-1">
                        <Download size={12} />
                        {formatDownloads(item.downloads)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {formatDownloads(item.followers)}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-d">{formatTimeAgo(item.date_modified)}</span>
                    
                    <Button 
                      className="mt-2 px-3 py-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Download size={14} className="mr-1" />
                      Install
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        
        {/* Load More */}
        {!isLoading && modpacks.length > 0 && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" className="px-6 py-2 text-sm">
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
