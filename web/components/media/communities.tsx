'use client';
// Communities tab, new community (with its Announcements group) and adding groups.
// Ported from js/sidebar.js (tabCommunities) and js/features.js.
import { S, ui, commit, useRender } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { openChat } from '@/lib/actions';
import { uid, pick, COLORS, chatById, lastMsg, listTime, firstName, preview } from '@/lib/util';
import type { Chat } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar, ChatAvatar } from '@/components/ui/Avatar';

export function newCommunityModal() {
  modal({
    title: 'New community',
    body: (
      <>
        <label className="field"><span>Community name</span><input id="cm-n" maxLength={40} placeholder="e.g. Hyderabad Startups" autoFocus /></label>
        <label className="field"><span>Description</span><input id="cm-d" maxLength={100} placeholder="What is this community about?" /></label>
        <p className="muted small">An Announcements group is created automatically — only admins can post there.</p>
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Create', primary: true, onClick: (root) => {
        const name = root.querySelector<HTMLInputElement>('#cm-n')!.value.trim();
        if (!name) { toast('Give your community a name'); return false; }
        const id = 'cm_' + uid(), color = pick(COLORS), t = Date.now();
        const mk = (gname: string, emoji: string, extra: Partial<Chat>): Chat => ({ id: 'ch_' + uid(), type: 'group', name: gname, community: id, emoji, color, members: [], admins: ['me'], unread: 0, messages: [{ id: uid(), type: 'system', from: 'system', t, text: `You created "${gname}"` }], ...extra });
        const ann = mk('Announcements', '📢', { readOnly: true }), gen = mk('General', '💬', {});
        S.chats.push(ann, gen);
        S.communities.push({ id, name, emoji: '🏘️', color, description: root.querySelector<HTMLInputElement>('#cm-d')!.value.trim(), groups: [ann.id, gen.id] });
        ui.tab = 'communities'; ui.page = null;
        commit(); toast('Community created');
      },
    }],
  });
}

export function addGroupToCommunity(cmId: string) {
  const cm = S.communities.find((c) => c.id === cmId);
  if (!cm) return;
  modal({
    title: 'Add group to ' + cm.name,
    body: <label className="field"><span>Group name</span><input id="ag-n" maxLength={40} placeholder="e.g. Sports Club" autoFocus /></label>,
    actions: [{ label: 'Cancel' }, {
      label: 'Create', primary: true, onClick: (root) => {
        const name = root.querySelector<HTMLInputElement>('#ag-n')!.value.trim();
        if (!name) return false;
        const g: Chat = { id: 'ch_' + uid(), type: 'group', name, community: cmId, emoji: '👥', color: pick(COLORS), members: [], admins: ['me'], unread: 0, messages: [{ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `You created group "${name}"` }] };
        S.chats.push(g); cm.groups.push(g.id); commit(); openChat(g.id);
      },
    }],
  });
}

export function CommunitiesTab() {
  useRender();
  return (
    <>
      <header className="side-head"><h2>Communities</h2><div className="head-actions"><button className="icon-btn" data-act="newcommunity" title="New community" aria-label="New community" onClick={newCommunityModal}><Icon name="add" /></button></div></header>
      <div className="side-scroll">
        <div className="list-row action" data-act="newcommunity" onClick={newCommunityModal}><span className="action-ic square"><Icon name="groups" size={22} /></span><div><div className="ci-name">New community</div><div className="ci-sub">Bring members together in topic-based groups</div></div></div>
        {S.communities.map((cm) => (
          <div key={cm.id} className="community">
            <div className="cm-head"><Avatar o={cm} size={48} extra="square" /><div><div className="ci-name">{cm.name}</div><div className="ci-sub">{cm.description || ''}</div></div></div>
            {cm.groups.map((gid: string) => {
              const g = chatById(gid);
              if (!g) return null;
              const m = lastMsg(g);
              return (
                <div key={g.id} className="chat-item sub" data-act="open" data-chat={g.id} onClick={() => openChat(g.id)}>
                  <ChatAvatar ch={g} size={40} />
                  <div className="ci-body">
                    <div className="ci-top"><span className="ci-name">{g.name}</span><span className={`ci-time ${g.unread ? 'unread' : ''}`}>{m ? listTime(m.t) : ''}</span></div>
                    <div className="ci-bottom"><span className="ci-preview">{m ? (m.from !== 'me' && m.type !== 'system' ? firstName(m.from) + ': ' : '') + preview(m) : ''}</span>{g.unread ? <span className="badge">{g.unread}</span> : null}</div>
                  </div>
                </div>
              );
            })}
            <button className="link-row" data-act="cm-addgroup" data-cm={cm.id} onClick={() => addGroupToCommunity(cm.id)}><Icon name="add" size={18} /> Add group</button>
          </div>
        ))}
      </div>
    </>
  );
}
