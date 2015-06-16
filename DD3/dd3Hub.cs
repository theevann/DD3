using System.Collections.Generic;
using Microsoft.AspNet.SignalR;
using Microsoft.AspNet.SignalR.Hubs;
using System;

namespace dd3
{
    public class dd3Hub : Hub
    {

        private readonly dd3Server _dd3Server;

        public dd3Hub() : this(dd3Server.Instance) { }

        public dd3Hub(dd3Server server)
        {
            _dd3Server = server;
        }

        public override System.Threading.Tasks.Task OnConnected()
        {
            return base.OnConnected();
        }

        public override System.Threading.Tasks.Task OnDisconnected(Boolean b)
        {
            return base.OnDisconnected(b);
        }


        public void updateInformation (BrowserInfo b)
        {
            _dd3Server.newClient(Context.ConnectionId, b);
        }

        public void synchronize(int sid)
        {
            _dd3Server.synchronize(sid);
        }

    }
}