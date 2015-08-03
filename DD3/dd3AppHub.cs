using System.Collections.Generic;
using Microsoft.AspNet.SignalR;
using Microsoft.AspNet.SignalR.Hubs;
using System;
using System.Collections.Concurrent;
using GDO.Core;
using GDO.Utility;

namespace GDO.Apps.DD3
{
    public class dd3AppHub : Hub, IAppHub
    {

        private readonly ConcurrentDictionary<int, IAppInstance> instances = Cave.Apps["dd3App"].Instances;
        private readonly object _locker = new Object();

        public string Name { get; set; }
        public int P2PMode { get; set; }
        public Type InstanceType { get; set; }

        public dd3AppHub () {
            this.Name = "dd3";
            this.P2PMode = (int) Cave.P2PModes.Neighbours;
            this.InstanceType = new dd3App().GetType();
        }

        public void JoinGroup(int instanceId)
        { 
            Groups.Add(Context.ConnectionId, "" + instanceId);
        }
        public void ExitGroup(int instanceId)
        {
            Groups.Remove(Context.ConnectionId, "" + instanceId);
        }

        public override System.Threading.Tasks.Task OnConnected()
        {
            return base.OnConnected();
        }

        public override System.Threading.Tasks.Task OnDisconnected(Boolean b)
        {
            return base.OnDisconnected(b);
        }

        public void updateInformation (int instanceId, BrowserInfo b)
        {
           ((dd3App) instances[instanceId]).newClient(Context.ConnectionId, b);
            JoinGroup(instanceId);
        }

        public void synchronize(int instanceId)
        {
            ((dd3App) instances[instanceId]).synchronize(Context.ConnectionId);
        }

        public void broadcastSynchronize(int instanceId)
        {
            Clients.Group("" + instanceId).synchronize();
        }

        public void broadcastConfiguration(int instanceId, string info)
        {
            Clients.Group("" + instanceId).receiveConfiguration(info, instanceId);
        }
    }
}