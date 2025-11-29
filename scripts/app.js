document.addEventListener('DOMContentLoaded', () => {
    // --- DATA ---
    const contractsData = {
        1: { id: 1, name: "Maintenance Mensuelle", ref: "CTR-2023-452", clientId: "1", siteName: "Site Alpha - Maintenance Mensuelle", siteAddress: "45 Rue du Port, 75002 Paris", startDate: "2023-01-01", endDate: "2025-12-31", alertDays: "60", amountHT: "12000", vatRate: "20", contacts: [{ role: "Gardien", name: "Jean Dupont", phone: "06 11 22 33 44" }], reports: [] },
        2: { id: 2, name: "Audit Sécurité", ref: "CTR-2023-480", clientId: "2", siteName: "Résidence Lilas - Audit Sécurité", siteAddress: "18 Avenue des Lilas, 75020 Paris", startDate: "2023-03-15", endDate: "2025-03-14", alertDays: "45", amountHT: "8500", vatRate: "20", contacts: [{ role: "Technique", name: "Sophie Leroy", phone: "06 55 44 33 22" }], reports: [] }
    };
    const reportsData = {
        1: { id: 1, contractId: 1, title: "Fuite d'eau - Local Technique", desc: "J'ai remarqué une flaque d'eau importante près de la chaudière. Ça semble couler du tuyau principal.", status: "Nouveau", statusClass: "bg-red-100 text-red-600", site: "Site Alpha Logistics", time: "29 Nov, 14:30", reporter: { name: "Marc Weber", phone: "06 88 77 66 55" }, photos: ["https://placehold.co/300x200/png?text=Photo+Fuite"], timeline: [{ type: 'creation', title: 'Signalement créé', time: '14:30', desc: "Un utilisateur a scanné le QR Code du Hall d'entrée.", icon: 'fa-qrcode', color: 'red' }] },
        2: { id: 2, contractId: 2, title: "Porte Garage Bloquée", desc: "La porte du garage souterrain ne s'ouvre plus avec le badge. Moteur semble HS.", status: "En cours", statusClass: "bg-orange-100 text-orange-600", site: "Résidence Lilas", time: "Hier, 09:15", reporter: { name: "Sophie Martin", phone: "07 12 34 56 78" }, photos: [], timeline: [{ type: 'creation', title: 'Signalement créé', time: 'Hier, 09:15', desc: "Scan QR Code Garage.", icon: 'fa-qrcode', color: 'orange' }, { type: 'note', title: 'Prise en charge', time: 'Hier, 09:30', desc: "Dossier pris en compte.", icon: 'fa-user-check', color: 'blue' }, { type: 'status', title: 'En cours de résolution', time: 'Hier, 10:00', desc: "Technicien en route.", icon: 'fa-screwdriver-wrench', color: 'orange' }] },
        3: { id: 3, contractId: 1, title: "Lumière Hall HS", desc: "Plus de lumière dans le hall B au rdc.", status: "Résolu", statusClass: "bg-green-100 text-green-600", site: "Site Alpha", time: "24 Oct, 18:00", reporter: { name: "Gardien", phone: "01 22 33 44 55" }, photos: [], isResolved: true, timeline: [{ type: 'creation', title: 'Signalement créé', time: '24 Oct, 18:00', desc: "Ampoule grillée.", icon: 'fa-qrcode', color: 'gray' }, { type: 'note', title: 'Réparation effectuée', time: '25 Oct, 09:00', desc: "Ampoule remplacée.", icon: 'fa-check', color: 'green' }] }
    };
    const employees = [
        { id: 1, name: "Thomas Martin", role: "Agent d'entretien", avatarColor: "bg-blue-100 text-blue-600" },
        { id: 2, name: "Julie Dubois", role: "Superviseur", avatarColor: "bg-purple-100 text-purple-600" },
        { id: 3, name: "Lucas Bernard", role: "Technicien", avatarColor: "bg-orange-100 text-orange-600" }
    ];

    // --- STATE ---
    let currentContractId = null;
    let editingContractId = null;
    let currentReportId = null;
    let currentAssignedEmployeeId = 1;
    let signaturePad;

    // --- UI FUNCTIONS ---

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('mobile-sidebar-backdrop');
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    }

    function closeSidebarOnMobile() {
        if (window.innerWidth < 1024) {
            toggleSidebar();
        }
    }

    function switchView(viewId, element) {
        ['view-dashboard', 'view-clients', 'view-contrats', 'view-signalements', 'view-rapports'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const targetView = document.getElementById('view-' + viewId);
        if (targetView) targetView.classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active', 'bg-white', 'text-sidebar-accent', 'shadow-sm');
        });

        if (element) {
            element.classList.add('active', 'bg-white', 'text-sidebar-accent', 'shadow-sm');
        }
         // If switching to signalements, also find the nav item and set it active
        if(viewId === 'signalements' && !element) {
            const nav = document.getElementById('nav-signalements');
            if(nav) nav.classList.add('active', 'bg-white', 'text-sidebar-accent', 'shadow-sm');
        }
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerHTML = `<i class="fa-solid fa-check text-green-400"></i> ${msg}`;
        toast.classList.remove('hidden');
        setTimeout(() => { toast.classList.add('hidden'); }, 2000);
    }
    
    // --- MODAL GENERIC FUNCTIONS ---
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if(!modal) return;
        const backdrop = modal.querySelector('.absolute.inset-0');
        const panel = modal.querySelector('.pointer-events-auto');

        modal.classList.remove('hidden');
        setTimeout(() => { 
            if(backdrop) backdrop.classList.remove('opacity-0'); 
            if(panel) panel.classList.remove('translate-x-full');
        }, 10);
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if(!modal) return;
        const backdrop = modal.querySelector('.absolute.inset-0');
        const panel = modal.querySelector('.pointer-events-auto');

        if(backdrop) backdrop.classList.add('opacity-0'); 
        if(panel) panel.classList.add('translate-x-full');
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    }

    // --- INITIALIZATION ---

    function initializeSignaturePad() {
        const canvas = document.getElementById('signature-canvas');
        if (canvas) {
            signaturePad = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)'
            });
        }
    }

    function init() {
        // Set default view
        const defaultNav = document.getElementById('nav-dashboard');
        switchView('dashboard', defaultNav);
        initializeSignaturePad();
        
        // Centralized event listener
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const actionTarget = target.closest('[data-action]');
            if (!actionTarget) return;

            const action = actionTarget.dataset.action;

            switch (action) {
                case 'toggle-sidebar':
                    toggleSidebar();
                    break;
                case 'switch-view':
                    e.preventDefault();
                    const view = actionTarget.dataset.view;
                    switchView(view, actionTarget.classList.contains('nav-item') ? actionTarget : null);
                    closeSidebarOnMobile();
                    break;
                case 'open-create-client':
                    openCreateClientModal();
                    break;
                case 'open-create-contract':
                    openCreateContractModal();
                    break;
                case 'edit-client':
                     const clientId = actionTarget.closest('[data-client-id]').dataset.clientId;
                     showToast(`Modifier client ID: ${clientId} (TODO)`);
                    break;
                case 'delete-client':
                    if(confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
                        showToast('Client supprimé (simulation)');
                    }
                    break;
                case 'edit-contract':
                     const contractId = actionTarget.closest('[data-contract-id]').dataset.contractId;
                     openContractEditModal(contractId);
                    break;
                case 'delete-contract':
                     if(confirm('Êtes-vous sûr de vouloir supprimer ce contrat ?')) {
                        showToast('Contrat supprimé (simulation)');
                    }
                    break;
                case 'open-create-report':
                    openModal('create-report-modal');
                    break;
                case 'close-create-report':
                    closeModal('create-report-modal');
                    break;
                case 'close-signature-pad':
                    closeModal('signature-pad-modal');
                    break;
                case 'clear-signature':
                    if(signaturePad) signaturePad.clear();
                    break;
                case 'save-signature':
                    if (signaturePad && !signaturePad.isEmpty()) {
                         showToast("Signature sauvegardée (simulation)");
                         closeModal('signature-pad-modal');
                    } else {
                        alert("Veuillez signer avant de valider.");
                    }
                    break;
                case 'close-contract-details':
                    closeModal('details-contract-modal');
                    break;
                 case 'open-contract-edit':
                    openContractEditModal(currentContractId);
                    break;
                case 'open-change-employee':
                    openModal('change-employee-modal');
                    break;
                case 'close-change-employee':
                    closeModal('change-employee-modal');
                    break;
                case 'select-employee':
                    const empId = actionTarget.dataset.id;
                    currentAssignedEmployeeId = empId;
                    updateEmployeeCard(empId);
                    showToast("Employé changé (simulation)");
                    closeModal('change-employee-modal');
                    break;
                case 'copy-text':
                    const textToCopy = actionTarget.dataset.text;
                    if(textToCopy) {
                        navigator.clipboard.writeText(textToCopy).then(() => showToast('Copié !'));
                    }
                    break;
                default:
                    console.warn('Action not handled:', action);
            }
        });
    }

    // --- Specific logic that needs access to data ---
    function openContractEditModal(id) {
        const data = contractsData[id];
        if (!data) return;
        editingContractId = id;
        openModal('create-contract-modal');
        showToast(`Modification du contrat: ${data.name}`);
    }

    function openCreateClientModal() {
        openModal('create-client-modal');
    }

    function openCreateContractModal() {
        openModal('create-contract-modal');
    }
    
    function updateEmployeeCard(empId) {
        const emp = employees.find(e => e.id == empId) || employees[0];
        const assignedEmployeeCard = document.getElementById('assigned-employee-card');
        if (assignedEmployeeCard) {
            assignedEmployeeCard.innerHTML = `
                <div class="w-12 h-12 rounded-full ${emp.avatarColor} flex items-center justify-center text-xl font-bold">
                    ${emp.name.charAt(0)}
                </div>
                <div>
                    <p class="font-bold text-gray-800">${emp.name}</p>
                    <p class="text-sm text-gray-500">${emp.role}</p>
                </div>
            `;
        }
    }

    // Run the app
    init();
});