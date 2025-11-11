

const { createApp } = Vue;

const vueApp = createApp({
    data() {
        return {
            officialLinks: [],
            channels: [],
            loading: true,
            error: null,
            currentSection: 'favorites',
            currentTime: '',
            favorites: {
                channels: [],
                programs: []
            },
            selectedChannel: null,
            selectedProgram: null,
            showBottomSheet: false,
            bottomSheetContent: null,
            showScheduleModal: false,
            showProgramDetailModal: false,
            searchQuery: '',
            showCookieBanner: false,
            cookiesAccepted: false,
        }
    },

    computed: {
        hasFavorites() {
            return this.favorites.channels.length > 0 || this.favorites.programs.length > 0;
        },

        favoriteChannels() {
            return this.channels.filter(channel => 
                this.favorites.channels.some(fav => fav.name === channel.name)
            );
        },

        favoriteProgramsWithInfo() {
            return this.favorites.programs.map(favProg => {
                const channel = this.channels.find(c => c.name === favProg.channelName);
                if (!channel) return null;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayProgram = channel.programs.find(p => {
                    const start = this.utcToLocal(p.start);
                    return p.title === favProg.title && start.toDateString() === today.toDateString();
                });

                return {
                    ...favProg,
                    key: `${favProg.channelName}:${favProg.title}`,
                    channel: channel,
                    todayProgram: todayProgram ?? false
                };
            }).filter(Boolean);
        },

        channelsWithCurrentProgram() {
            return this.channels.filter(channel => this.getCurrentProgram(channel) !== null);
        },

        channelsWithEveningPrograms() {
            return this.channels.filter(channel => this.getEveningPrograms(channel).length > 0);
        },

        searchResults() {
            if (this.searchQuery.length < 3) return [];

            const results = [];
            const searchLower = this.searchQuery.toLowerCase();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            this.channels.forEach(channel => {
                if (channel.name.toLowerCase().includes(searchLower)) {
                    results.push({
                        type: 'channel',
                        channel: channel,
                        program: null,
                        key: `channel-${channel.id}`,
                        image: channel.logo,
                        title: channel.name,
                    });
                }

                channel.programs.forEach(program => {
                    if (program.title.toLowerCase().includes(searchLower)) {
                        const start = this.utcToLocal(program.start);
                        if (start.toDateString() === today.toDateString()) {
                            results.push({
                                type: 'program',
                                channel: channel,
                                program: program,
                                key: `program-${channel.id}-${program.start}`,
                                image: program.image ?? channel.logo,
                                title: program.title
                            });
                        }
                    }
                });
            });

            return results;
        },

        timeSlots() {
            const slots = [];
            for (let hour = 20; hour <= 22; hour++) {
                slots.push(`${hour}:00`);
                slots.push(`${hour}:30`);
            }
            return slots;
        }
    },

    methods: {
        async loadData() {
            this.loading = true;
            this.error = null;

                try {
                    // fetch local file
                    response = await fetch('/data/channels.json');
                    if (!response.ok) throw new Error('Direct fetch failed');

                    this.officialLinks = await response.json();

            } catch (err) {
                console.error('Errore nel caricamento officialLinks:', err);
                this.officialLinks = [];
            }

            try {
                
                //const originalUrl = 'https://www.emax83dev.it/api/epg';
                const originalUrl = '/data/list.json';
                
                let response;
                try {
                    response = await fetch(originalUrl);
                    if (!response.ok) throw new Error('Direct fetch failed');
                } catch (directError) {
                    const corsProxies = [
                        '/api/epg', //local serverless function
						`https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
						`https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
						`https://cors-anywhere.herokuapp.com/${originalUrl}`
					];
                    
                    for (const proxyUrl of corsProxies) {
                        try {
                            response = await fetch(proxyUrl);
                            if (response.ok) break;
                        } catch (e) {
                            console.log('Proxy failed:', e);
                        }
                    }
                }

                if (!response || !response.ok) {
                    throw new Error('Impossibile caricare i dati');
                }

                const jsonData = await response.json();
                
                this.channels = jsonData.map(item => ({
                    id: item.id,
                    name: item.name,
                    epgName: item.epgName,
                    logo: item.logo,
                    playlist: item.m3uLink,
                    playUrl: this.officialLinks.find(link => link.epgName === item.name)?.playUrl || null,
                    programs: item.programs.map(program => ({
                        start: program.start,
                        stop: program.end,
                        title: program.title,
                        description: program.description,
                        category: program.category,
                        image: program.poster
                    }))
                }));

                this.loading = false;
                this.autoOpenFirstChannel();

            } catch (error) {
                console.error('Error loading data:', error);
                this.error = error.message;
                this.loading = false;
            }
        },

        utcToLocal(utcDateStr) {
            const date = new Date(utcDateStr);
            return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
        },

        formatTime(date) {
            date = new Date(date);
            return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        },

        updateCurrentTime() {
            const now = new Date();
            this.currentTime = this.formatTime(now);
        },

        getCurrentProgram(channel) {
            const now = new Date();
            return channel.programs.find(program => {
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                return now >= start && now < end;
            });
        },

        getEveningPrograms(channel) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            return channel.programs.filter(program => {
                const start = this.utcToLocal(program.start);
                const hour = start.getHours();
                const isSameDay = start.toDateString() === today.toDateString();
                return isSameDay && hour >= 20 && hour < 23;
            });
        },

        getEpgProgramStyle(program) {
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            
            // Base time: 20:00
            const baseTime = new Date(start);
            baseTime.setHours(20, 0, 0, 0);
            
            // Calculate minutes from 20:00
            const startMinutes = (start - baseTime) / 1000 / 60;
            const duration = (end - start) / 1000 / 60;
            
            // Each 30 min slot is 60px
            const pixelsPerMinute = 60 / 30;
            const top = startMinutes * pixelsPerMinute;
            const height = duration * pixelsPerMinute;
            
            return {
                top: `${top}px`,
                height: `${Math.max(height - 4, 30)}px` // Min height 30px, -4px for spacing
            };
        },

        getTodayPrograms(channel) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            return channel.programs
                .filter(program => {
                    const start = this.utcToLocal(program.start);
                    return start.toDateString() === today.toDateString();
                })
                .sort((a, b) => this.utcToLocal(a.start) - this.utcToLocal(b.start));
        },

        calculateProgress(program) {
            const now = new Date();
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            const total = end - start;
            const elapsed = now - start;
            return Math.min(100, Math.max(0, (elapsed / total) * 100));
        },

        getDuration(program) {
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            const minutes = Math.round((end - start) / 60000);
            return `${minutes} min`;
        },

        isCurrentProgram(channel, program) {
            const current = this.getCurrentProgram(channel);
            return current?.title === program.title;
        },

        isFavoriteProgramScheduled(favorite){
            // Trova il canale
            const channel = this.channels.find(ch => ch.name === favorite.channelName);
            if (!channel || !channel.programs) return false;

            // Trova il programma con lo stesso titolo
            const program = channel.programs.find(p => p.title === favorite.title);
            if (program) {
                return true;
            }
            else{
                return false;
            }
        },

        isFavoriteProgramLive(favorite){
            // Trova il canale
            const channel = this.channels.find(ch => ch.name === favorite.channelName);
            if (!channel || !channel.programs) return false;

            // Trova il programma con lo stesso titolo
            const program = channel.programs.find(p => p.title === favorite.title);
            if (!program) return false;

            // Verifica se è attualmente in onda
            const now = new Date();
            const start = new Date(program.start);
            const stop = new Date(program.stop);

            return now >= start && now <= stop;
        },

        isProgramLive(program) {
            if (program){
                const now = new Date();
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                return now >= start && now < end;
            }
            return false;
        },

        loadFavorites() {
            try {
                const stored = localStorage.getItem('guidatv_favorites');
                if (stored) {
                    this.favorites = JSON.parse(stored);
                }
            } catch (e) {
                console.error('Error loading favorites:', e);
            }
        },

        saveFavorites() {
            try {
                localStorage.setItem('guidatv_favorites', JSON.stringify(this.favorites));
            } catch (e) {
                console.error('Error saving favorites:', e);
            }
        },

        toggleFavoriteChannel(channel) {
            const index = this.favorites.channels.findIndex(c => c.name === channel.name);
            if (index > -1) {
                this.favorites.channels.splice(index, 1);
            } else {
                this.favorites.channels.push({
                    name: channel.name,
                    logo: channel.logo,
                    playlist: channel.playlist
                });
            }
            this.saveFavorites();
        },

        toggleFavoriteProgram(channel, program) {
            const key = `${channel.name}:${program.title}`;
            const index = this.favorites.programs.findIndex(p => 
                `${p.channelName}:${p.title}` === key
            );
            
            if (index > -1) {
                this.favorites.programs.splice(index, 1);
            } else {
                this.favorites.programs.push({
                    channelName: channel.name,
                    channelLogo: channel.logo,
                    title: program.title,
                    category: program.category
                });
            }
            this.saveFavorites();
        },

        removeFavoriteProgram(prog) {
            const index = this.favorites.programs.findIndex(p => 
                p.channelName === prog.channelName && p.title === prog.title
            );
            if (index > -1) {
                this.favorites.programs.splice(index, 1);
                this.saveFavorites();
            }
        },

        isFavoriteChannel(channel) {
            return this.favorites.channels.some(c => c.name === channel.name);
        },

        isFavoriteProgram(channel, program) {
            const key = `${channel.name}:${program.title}`;
            return this.favorites.programs.some(p => 
                `${p.channelName}:${p.title}` === key
            );
        },

        showNowPlaying(channel) {
            const currentProgram = this.getCurrentProgram(channel);
            if (!currentProgram) return;

            this.selectedChannel = channel;
            this.selectedProgram = currentProgram;
            this.showBottomSheet = true;
        },

        showEveningPrograms(channel) {
            this.selectedChannel = channel;
            this.showBottomSheet = true;
        },

        showProgramInModal(channel, program) {
            this.selectedChannel = channel;
            this.selectedProgram = program;
            this.showScheduleModal = false;
            this.showProgramDetailModal = true;
            this.showBottomSheet = true;
        },

        showChannelSchedule(channel) {
            this.selectedChannel = channel;
            this.selectedProgram = null;
            this.showScheduleModal = true;
            this.showProgramDetailModal = false;
        },

        openChannelDetail(channel) {
            const currentProgram = this.getCurrentProgram(channel);
            if (currentProgram) {
                this.showNowPlaying(channel);
            } else {
                this.showChannelSchedule(channel);
            }
        },

        handleSearchResultClick(result) {
             if(result.type == 'channel'){
                this.showChannelSchedule(result.channel);
            } else if (result.type == 'program'){
                this.showProgramInModal(result.channel, result.program);
            }
        },

        handleFavoriteChannelClick(channel){
            this.showChannelSchedule(channel);
        },

        handleFavoriteProgramClick(program) {
            if (program.todayProgram) {
                const sameTitlePrograms = program.channel.programs.filter(
                    item => item.title === program.title
                );
                var channel = program.channel;
                channel.programs = sameTitlePrograms;
                this.showChannelSchedule(channel);
                //this.showChannelSchedule(program.channel);

            } else {
                alert(`"${program.title}" non è programmato oggi su ${program.channelName}`);
            }
        },

        loadCookieConsent() {
            try {
                const stored = localStorage.getItem('guidatv_cookie_consent');
                if (!stored) {
                    setTimeout(() => {
                       this.showCookieBanner = true;
                        this.cookiesAccepted = false;
                    }, 1000);
                }
                else{
                    const opt = JSON.parse(stored);
                    this.showCookieBanner = opt.bannerVisible;
                    this.cookiesAccepted = opt.cookiesAccepted;
                }

                if(this.cookiesAccepted == true){
                    //carico gli script di trackind
                    this.loadTrackingScripts();
                }
            } catch (e) {
                console.error('Error loading cookie consent:', e);
            }
        },

        acceptCookies(accepted) {
            try {
                this.showCookieBanner = false;
                this.cookiesAccepted = accepted;
                localStorage.setItem('guidatv_cookie_consent', JSON.stringify({
                    bannerVisible: false,
                    cookiesAccepted: accepted
                }));

                this.loadCookieConsent();

            } catch (e) {
                console.error('Error saving cookie consent:', e);
            }
        },
        loadTrackingScripts(){
            try{

            }
            catch(err){
                console.error('loadTrackingScripts; Error saving cookie consent:', e);
            }
        },

        handleImageError(event) {
            event.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%231a1f3a' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%230dcaf0' text-anchor='middle' dy='.3em'%3ETV%3C/text%3E%3C/svg%3E";
        },

        autoOpenFirstChannel() {
            if (this.hasFavorites) {
                this.currentSection = 'favorites';
            } else {
                this.currentSection = 'now';
                setTimeout(() => {
                    const firstChannel = this.channelsWithCurrentProgram[0];
                    if (firstChannel) {
                        this.showNowPlaying(firstChannel);
                    }
                }, 500);
            }
        }
    },

    mounted() {
        this.loadFavorites();
        this.loadCookieConsent();
        this.loadData();
        this.updateCurrentTime();
        setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
    }
}).mount('#app');

